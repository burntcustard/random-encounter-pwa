import { createEffect, createSignal, Index, on } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { SolidMarkdown } from 'solid-markdown'
import matter from 'gray-matter'
import defaultTabData from './default-tab-data.md?raw'
import { Toolbar } from './Toolbar'

export const silentMatter = (rawText: string) => {
  let grayMatter = null

  try {
    grayMatter = matter(rawText)
  } catch(error) {
    console.warn('Unable to parse markdown, reason:', (error as Error).message)
  }

  return grayMatter
}

export const Tabs = () => {
  const localSelectedTabIndex = localStorage.getItem('selectedTabIndex')
  const [selectedTabIndex, setSelectedTabIndex] = createSignal(localSelectedTabIndex ? parseInt(localSelectedTabIndex) : 0)

  let tabId = 0

  const [tabStore, setTabStore] = createStore<{
    id: number;
    grayMatter: ReturnType<typeof silentMatter>;
    rawText: string;
    editorHidden: boolean;
  }[]>([])

  const addTab = (rawText: string) => {
    setTabStore(
      produce((tabsData) => {
        tabsData.push({ id: ++ tabId, grayMatter: silentMatter(rawText), rawText, editorHidden: false })
      })
    )
  }

  const updateTab = (id: number, rawText: string) => {
    setTabStore(
      tabData => tabData.id === id,
      produce((tabData) => {
        const parsedText = silentMatter(rawText)

        if (parsedText) {
          tabData.grayMatter = parsedText
          tabData.rawText = rawText
        }
      })
    )
  }

  const removeTab = (id: number) => {
    setTabStore(tabData => tabData.filter((t) => t.id !== id))
    // Set the selected tab to the one of the left of the removed one
    if (selectedTabIndex() >= tabStore.length) setSelectedTabIndex(tabStore.length - 1)
  }

  const tabToggleEditor = (id: number) => {
    setTabStore(
      tab => tab.id === id,
      produce((tab) => (tab.editorHidden = !tab.editorHidden)),
    )
  }

  createEffect(() => {
    localStorage.setItem('tabsData', JSON.stringify(tabStore.map((tab) => tab.rawText)))
  }, { defer: true })

  const defaultData = [ defaultTabData ]
  const localData = localStorage.getItem('tabsData')
  const startingData = (localData ? JSON.parse(localData) : defaultData)

  startingData.forEach((rawTabData: string) => addTab(rawTabData))

  createEffect(on(selectedTabIndex, (selectedTabIndex) => {
    localStorage.setItem('selectedTabIndex', selectedTabIndex.toString())
  }, { defer: true }))

  const handleFileChange = async (event: { target: { files: any } }) => {
    for (const file of event.target.files) {
      // TODO: Don't add files that are identical to existing ones - show a warning message instead.
      addTab(await file.text())
      setSelectedTabIndex(tabStore.length - 1)
    }
  }

  const handleAddTabButtonClick = () => {
    addTab('---\ntitle: New tab X\n---\n\n# Heading 1')
    setSelectedTabIndex(tabStore.length - 1)
  }

  let editorTextareaRef: HTMLTextAreaElement | undefined;

  return (
    <div class="tabs">
      <div>
        <input
          type="file"
          id="upload-md"
          name="upload-md"
          accept=".md"
          onchange={handleFileChange}
        />
      </div>

      <div role="tablist" aria-label="Tabs">
        <Index each={tabStore}>{(tab, index) =>
          <button
            role="tab"
            aria-selected={selectedTabIndex() === index}
            aria-controls={`panel-${index}`}
            id={`tab-button-${index}`}
            tabindex={selectedTabIndex() === index ? -1 : 0}
            onClick={() => setSelectedTabIndex(index)}
          >
            {tab().grayMatter?.data.title}
          </button>
        }</Index>

        <button onClick={handleAddTabButtonClick} class="add">
          <svg width="16" height="16" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg" stroke="currentcolor">
            <path d="M1 4 H7 M4 1 V7"/>
          </svg>
        </button>
      </div>

      <div class="panel-wrapper">
        <Index each={tabStore}>{(tab, index) =>
          <div
            id={`panel-${index}`}
            role="tabpanel"
            tabindex="0"
            aria-labelledby={`tab-button-${index}`}
            aria-hidden={selectedTabIndex() === index ? undefined : true}
            class="tab-content"
          >
            <div class="content-and-editor">
              <SolidMarkdown class="content" children={tab().grayMatter?.content} />

              <button onclick={() => tabToggleEditor(tab().id)} class="toggle-editor">
                - - - {tab().editorHidden ? 'Show' : 'Hide'} Editor - - -
              </button>

              <div class="editor" aria-hidden={tab().editorHidden}>
                <Toolbar tab={tab} removeTab={removeTab} index={index} />

                <label for={`tab-md-input-${index}`}>
                  Content Editor (<a href="https://www.markdownguide.org/cheat-sheet/">markdown</a>)
                </label>
                <textarea
                  id={`tab-md-input-${index}`}
                  rows="1"
                  cols="50"
                  oninput={(e) => updateTab(tab().id, e.target.value)}
                  ref={editorTextareaRef}
                >
                  {tab().rawText}
                </textarea>
              </div>
            </div>
          </div>
        }</Index>
      </div>
    </div>
  )
}
