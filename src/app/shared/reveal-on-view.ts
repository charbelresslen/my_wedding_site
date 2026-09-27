import { DestroyRef, ElementRef, Signal, afterNextRender, inject, signal } from '@angular/core';

/**
 * Becomes true (and stays true) once the component's element has scrolled into view; the section's entrance
 * animation is driven by it. Where IntersectionObserver is missing it is true at once, so nothing stays hidden.
 * Call it from a field initializer (it needs the injection context).
 */
export function revealOnView(threshold = 0.25): Signal<boolean> {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);
  const visible = signal(false);

  afterNextRender(() => {
    if (typeof IntersectionObserver !== 'function') {
      visible.set(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          visible.set(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(host.nativeElement);
    destroyRef.onDestroy(() => observer.disconnect());
  });

  return visible.asReadonly();
}

/**
 * Plays the entrance of each part of a component when that part scrolls into view: every `[data-reveal]` element inside
 * it gets the class `is-visible` once at least `threshold` of it is on the screen. Where IntersectionObserver is
 * missing every part is shown at once, so nothing stays hidden. Call it from the constructor (it needs the injection
 * context).
 */
export function revealParts(threshold = 0.3): void {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);

  afterNextRender(() => {
    const parts = [...host.nativeElement.querySelectorAll<HTMLElement>('[data-reveal]')];
    if (typeof IntersectionObserver !== 'function') {
      parts.forEach((part) => part.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold },
    );
    parts.forEach((part) => observer.observe(part));
    destroyRef.onDestroy(() => observer.disconnect());
  });
}
