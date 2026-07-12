export default defineAppConfig({
  ui: {
    colors: {
      primary: 'zinc',
      neutral: 'zinc',
    },

    // Cards: raised surface, borderless, soft lift — they float on the canvas.
    card: {
      slots: { root: 'rounded-xl shadow-sm' },
      variants: { variant: { outline: { root: 'bg-[var(--app-surface)] ring-0' } } },
    },

    // Main content = recessed canvas with generous padding + negative space.
    dashboardPanel: {
      slots: {
        root: 'bg-[var(--app-canvas)]',
        body: 'p-5 sm:p-8 gap-6',
      },
    },

    // Navbar sits on the canvas — no bottom border, just breathing room.
    dashboardNavbar: {
      slots: {
        root: 'border-b-0 px-5 sm:px-8',
        title: 'text-base',
      },
    },

    // Sidebar: raised surface (matches cards), borderless, roomier rows.
    dashboardSidebar: {
      slots: {
        root: 'bg-[var(--app-surface)]',
        header: 'px-5',
        body: 'px-3 py-4 gap-4',
        footer: 'px-3 py-3',
      },
      variants: { side: { left: { root: 'border-e-0' } } },
    },

    // Nav links: taller rows, more icon↔label breathing room, softer active pill.
    navigationMenu: {
      slots: {
        root: 'gap-6',
        link: 'px-3 py-2.5 gap-2.5',
        linkLeadingIcon: 'size-5',
        childLink: 'px-3 py-2',
      },
    },

    button: {
      slots: { base: 'rounded-lg font-medium' },
    },
  },
})
