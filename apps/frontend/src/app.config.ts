export default defineAppConfig({
  ui: {
    colors: {
      primary: 'zinc',
      neutral: 'zinc',
      warning: 'amber', // the one accent color (amber) — used sparingly on dark surfaces
    },

    // Cards: raised surface, borderless, soft lift — they float on the canvas.
    card: {
      slots: {
        root: 'rounded-xl shadow-sm',
        header: 'text-sm font-semibold tracking-tight',
      },
      variants: { variant: { outline: { root: 'bg-[var(--app-surface)] ring-0' } } },
    },

    // Main content = recessed canvas with generous padding + negative space.
    dashboardPanel: {
      slots: {
        root: 'bg-[var(--app-canvas)]',
        body: 'p-5 sm:p-8 gap-6',
      },
    },

    // Navbar sits on the canvas — no bottom border; the title is the page's H1.
    dashboardNavbar: {
      slots: {
        root: 'border-b-0 px-5 sm:px-8 pt-1',
        title: 'text-xl font-bold tracking-tight',
      },
    },

    // Sidebar: ALWAYS dark, whatever the app mode — the `dark` class scopes Nuxt UI's
    // dark tokens to this subtree (nav text, badges, and the logo's dark:invert flip).
    dashboardSidebar: {
      slots: {
        root: 'dark bg-neutral-950 text-neutral-200',
        header: 'px-4 pt-5 pb-2',
        body: 'px-3 py-3 gap-6',
        footer: 'px-3 py-3',
      },
      variants: { side: { left: { root: 'border-e-0' } } },
    },

    // Nav links: rounded active pill, taller rows, breathing room, uppercase
    // section labels. Active row = subtle white pill + amber icon (the accent).
    navigationMenu: {
      slots: {
        root: 'gap-6',
        label: 'px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-dimmed',
        link: 'px-3 py-2.5 gap-3 rounded-lg font-medium',
        linkLeadingIcon: 'size-5 text-dimmed',
        childLink: 'px-3 py-2 rounded-lg',
        childList: 'ms-4 border-s border-default ps-3',
      },
      variants: {
        active: {
          true: { link: 'bg-white/10 text-white', linkLeadingIcon: 'text-amber-400' },
          false: { link: 'text-muted hover:text-white hover:bg-white/5' },
        },
      },
      // The theme's own compoundVariants (color+active) append later and win the
      // tailwind-merge — re-assert the amber active icon at the same specificity.
      compoundVariants: [
        { color: 'neutral', active: true, class: { linkLeadingIcon: 'text-amber-400' } },
      ],
    },

    // Tables read as cards: raised surface, rounded, quiet uppercase headers.
    table: {
      slots: {
        root: 'bg-[var(--app-surface)] rounded-xl shadow-sm',
        th: 'text-[0.6875rem] font-semibold uppercase tracking-wider text-dimmed',
        td: 'text-sm',
      },
    },

    badge: {
      slots: { base: 'rounded-full font-medium' },
    },

    button: {
      slots: { base: 'rounded-lg font-medium' },
    },
  },
})
