import type { ReactNode } from "react"

const notesDesktopStyles = `
@media (min-width: 64rem) {
  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) {
    display: grid !important;
    grid-template-columns: minmax(20rem, 22rem) minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr);
    gap: 1.25rem !important;
    min-height: 0;
    overflow: hidden;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main section:has(> [data-testid="notes-card-list"]) {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main section:has(> [data-testid="notes-card-list"]) > div:first-child {
    display: block !important;
    min-width: 0;
    max-width: 100%;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main section:has(> [data-testid="notes-card-list"]) > div:first-child > div:first-child > p {
    flex-shrink: 0;
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="notes-card-list"] {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    height: auto !important;
    min-height: 0 !important;
    flex: 1 1 0% !important;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: auto;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="notes-card-list"] > div {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    padding: 0.5rem !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="notes-card-list"] > div > button {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="card-editor-fields"] {
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.25rem;
    padding-bottom: 1.5rem;
    scrollbar-gutter: auto;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 1.5rem;
    scrollbar-gutter: auto;
  }

  [data-app-view="notes"] #app-main [data-testid="card-editor-fields"] {
    display: flex !important;
  }

  [data-app-view="notes"] #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    display: none !important;
  }

  [data-app-view="note-detail"] #app-main div:has(> section > [data-testid="notes-card-list"]) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  }

  [data-app-view="note-detail"] #app-main section:has(> [data-testid="notes-card-list"]) {
    display: none !important;
  }

  [data-app-view="note-detail"] #app-main [data-testid="card-editor-fields"] {
    display: flex !important;
  }

  [data-app-view="note-detail"] #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    display: block !important;
  }

  [data-app-view="note-detail"] [data-testid="note-view-toggle"] {
    display: none !important;
  }
}

@media (min-width: 80rem) {
  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) {
    grid-template-columns: minmax(20rem, 22rem) minmax(20rem, 0.95fr) minmax(20rem, 1.05fr) !important;
    gap: 1.5rem !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main section:has(> [data-testid="notes-card-list"]) {
    display: flex !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main [data-testid="card-editor-fields"] {
    display: flex !important;
  }

  :is([data-app-view="notes"], [data-app-view="note-detail"]) #app-main div:has(> section > [data-testid="notes-card-list"]) > section:last-child {
    display: block !important;
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
