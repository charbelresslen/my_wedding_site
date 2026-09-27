import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { revealParts } from '../shared/reveal-on-view';

/**
 * The local API that serves the menu and saves each guest's answer (see `server/` next to this project: a small
 * Express server, its README and the MySQL schema it needs). The site and the API are two separate processes on two
 * separate ports (see `API_PORT`); this asks for the API at whatever address loaded THIS page, but on the API's own
 * port - so a phone (or anyone else reaching the site by its VM's address, its LAN IP, or its real domain) reaches
 * that same machine's API, rather than uselessly trying its own `localhost`. Change `API_PORT` if the API is ever
 * moved to a different port.
 *
 * If `server/` is instead put behind a reverse proxy under the SAME address as the site (Nginx forwarding `/api/...`
 * to the API process, as in `DEPLOY.md`'s guide), set `SAME_ORIGIN` to `true`: the form will then use a plain
 * `/api/...` path with no host or port of its own, and let the proxy sort out where it actually goes.
 */
const SAME_ORIGIN = false;
const API_PORT = 3010;
const API_BASE = SAME_ORIGIN ? '' : `${location.protocol}//${location.hostname}:${API_PORT}`;

interface MenuItem {
  id: number;
  name: string;
}

interface FoodCategory extends MenuItem {
  items: MenuItem[];
}

interface Menu {
  drinkOptions: MenuItem[];
  foodCategories: FoodCategory[];
}

type Attendance = 'both' | 'zags_only';

/** The server's error codes (see `server/index.js`), turned into the sentence a guest actually reads. */
function friendlyError(code: unknown): string {
  switch (code) {
    case 'MISSING_NAME':
      return 'Пожалуйста, напишите ваше имя и фамилию.';
    case 'NAME_TOO_LONG':
      return 'Это имя слишком длинное — попробуйте покороче.';
    case 'INVALID_ATTENDANCE':
      return 'Пожалуйста, выберите один из двух вариантов.';
    case 'MISSING_DRINK':
    case 'INVALID_DRINK':
      return 'Пожалуйста, выберите напиток.';
    case 'MISSING_FOOD_CHOICE':
      return 'Пожалуйста, выберите блюдо в каждой категории.';
    default:
      return 'Что-то пошло не так. Пожалуйста, попробуйте ещё раз.';
  }
}

/**
 * Step 10: "Подтверждение" (RSVP). A quiet card with a deadline and one button; the button opens a form (full name,
 * whether the guest comes only to the ZAGS ceremony or stays for the banquet, and — only for the banquet — one drink
 * and one dish from each menu category). The menu itself lives in the database (`server/schema.sql`), fetched once
 * the form opens, so the couple can edit it there without touching this file. Answers are saved by the small local
 * API in `server/`; see its README for how to run it and where the MySQL tables come from.
 */
@Component({
  selector: 'app-rsvp',
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rsvp {
  private readonly http = inject(HttpClient);

  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly nameField = viewChild<ElementRef<HTMLInputElement>>('nameField');

  protected readonly open = signal(false);

  protected readonly menu = signal<Menu | null>(null);
  protected readonly menuLoading = signal(false);
  protected readonly menuError = signal(false);

  protected readonly fullName = signal('');
  protected readonly attendance = signal<Attendance | null>(null);
  protected readonly drinkOptionId = signal<number | null>(null);
  protected readonly foodChoices = signal<Record<number, number>>({});

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly canSubmit = computed(() => {
    if (!this.fullName().trim()) return false;
    const attendance = this.attendance();
    if (!attendance) return false;
    if (attendance === 'zags_only') return true;
    const menu = this.menu();
    if (!menu || this.drinkOptionId() == null) return false;
    const chosen = this.foodChoices();
    return menu.foodCategories.every((category) => chosen[category.id] != null);
  });

  constructor() {
    // the heading, the sentence and the button play their entrance as the section scrolls into view
    revealParts(0.3);

    // the page behind the dialog holds still while it is open
    effect(() => {
      document.body.style.overflow = this.open() ? 'hidden' : '';
    });
  }

  protected openForm(): void {
    this.open.set(true);
    if (!this.menu() && !this.menuLoading()) this.fetchMenu();
    setTimeout(() => this.nameField()?.nativeElement.focus(), 0);
  }

  protected close(): void {
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  protected onOverlayPointerDown(event: PointerEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  /** Escape closes the dialog; Tab is kept inside it (a simple focus trap) while it is open. */
  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onNameInput(event: Event): void {
    this.fullName.set((event.target as HTMLInputElement).value);
  }

  protected setAttendance(value: Attendance): void {
    this.attendance.set(value);
  }

  protected setFoodChoice(categoryId: number, itemId: number): void {
    this.foodChoices.update((current) => ({ ...current, [categoryId]: itemId }));
  }

  protected fetchMenu(): void {
    this.menuLoading.set(true);
    this.menuError.set(false);
    this.http.get<Menu>(`${API_BASE}/api/menu`).subscribe({
      next: (menu) => {
        this.menu.set(menu);
        this.menuLoading.set(false);
      },
      error: () => {
        this.menuLoading.set(false);
        this.menuError.set(true);
      },
    });
  }

  protected submit(): void {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const attendance = this.attendance();
    const body =
      attendance === 'both'
        ? { fullName: this.fullName().trim(), attendance, drinkOptionId: this.drinkOptionId(), foodChoices: this.foodChoices() }
        : { fullName: this.fullName().trim(), attendance };

    this.http.post(`${API_BASE}/api/rsvp`, body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.submitError.set(friendlyError(err.error?.error));
      },
    });
  }
}
