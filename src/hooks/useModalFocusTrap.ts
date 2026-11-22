import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Filter for elements that are actually visible and focusable in the document flow.
 */
function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  // If element has offsetParent or is connected and not hidden
  if ('offsetParent' in el && el.offsetParent === null && el !== document.activeElement) {
    return false;
  }
  const style = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(el) : null;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) {
    return false;
  }
  return true;
}

/**
 * Custom hook to trap focus within a modal/dialog container,
 * handle Escape key dismissal, and restore focus to the previously active element on close.
 *
 * Uses stable refs for `onClose` and `restoreFocus` so parent rerenders or callback
 * recreations do NOT cause effect teardown and premature focus restoration.
 */
export function useModalFocusTrap({
  isOpen,
  onClose,
  restoreFocus = true,
}: {
  isOpen: boolean;
  onClose?: () => void;
  restoreFocus?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Keep latest callback in a ref to avoid re-triggering effect on identity changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;

  // Track previous isOpen state to differentiate between prop updates and real close/open transitions
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // If modal was previously open and now closed, restore focus
      if (prevIsOpenRef.current) {
        prevIsOpenRef.current = false;
        if (restoreFocusRef.current && triggerRef.current) {
          try {
            if (typeof triggerRef.current.focus === 'function' && triggerRef.current.isConnected) {
              triggerRef.current.focus();
            }
          } catch {
            // Ignore if element is no longer focusable
          }
        }
      }
      return;
    }

    // Modal is open
    prevIsOpenRef.current = true;

    // Capture triggering element before dialog takes focus (only if not already inside the dialog)
    const active = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (active && (!container || !container.contains(active))) {
      triggerRef.current = active;
    }

    if (container) {
      // Focus first interactive element inside dialog or container itself
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isFocusable);

      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        // Fallback: focus the container itself if focusable, or set tabindex
        if (!container.hasAttribute('tabindex')) {
          container.setAttribute('tabindex', '-1');
        }
        container.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const dialog = containerRef.current;
        if (!dialog) return;

        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter(isFocusable);

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // If unmounting while still marked as open, restore focus
      if (prevIsOpenRef.current && restoreFocusRef.current && triggerRef.current) {
        try {
          if (typeof triggerRef.current.focus === 'function' && triggerRef.current.isConnected) {
            triggerRef.current.focus();
          }
        } catch {
          // Ignore
        }
      }
    };
  }, [isOpen]);

  return containerRef;
}
