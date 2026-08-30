import type { ReactNode } from "react"

const notesDesktopStyles = `
@media (min-width: 64rem) {
  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) {
    display: grid !important;
    grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr);
    gap: 1.25rem !important;
    min-height: 0;
    overflow: hidden;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main section:has(> [data-testid="notes-card-list"]) > div:first-child {
    display: block !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="notes-card-list"] {
    height: auto !important;
    min-height: 0 !important;
    flex: 1 1 0% !important;
    scrollbar-gutter: stable;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="card-editor-fields"] {
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.25rem;
    padding-bottom: 1.5rem;
    scrollbar-gutter: stable;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 1.5rem;
    scrollbar-gutter: stable;
  }

  [data-app-view="notes"] #app-main [data-testid="card-editor-fields"] {
    display: flex !important;
  }

  [data-app-view="notes"] #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    display: none !important;
  }

  [data-app-view="note-detail"] #app-main [data-testid="card-editor-fields"].hidden {
    display: none !important;
  }

  [data-app-view="note-detail"] #app-main [data-testid="card-editor-fields"]:not(.hidden) {
    display: flex !important;
  }

  [data-app-view="note-detail"] #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child.hidden {
    display: none !important;
  }

  [data-app-view="note-detail"] #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child:not(.hidden) {
    display: block !important;
  }

  [data-app-view="note-detail"] [data-testid="note-view-toggle"] {
    display: flex !important;
  }
}

@media (min-width: 80rem) {
  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) {
    grid-template-columns: minmax(15rem, 18rem) minmax(20rem, 0.95fr) minmax(20rem, 1.05fr) !important;
    gap: 1.5rem !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="card-editor-fields"] {
    display: flex !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    display: block !important;
  }

  [data-app-view="note-detail"] [data-testid="note-view-toggle"] {
    display: none !important;
  }
}
`

export default function NotesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{notesDesktopStyles}</style>
    </>
  )
}
