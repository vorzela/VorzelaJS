import { createFileRoute, filterSearch, useNavigate } from '~/router'

const SORT_OPTIONS = ['relevance', 'newest', 'name'] as const

type SortOption = typeof SORT_OPTIONS[number]

type FiltersSearch = {
  featured: boolean
  page: number
  q: string
  sort: SortOption
  tag: string[]
}

export const Route = createFileRoute('/filters')({
  head: () => ({
    meta: [
      {
        content: 'URL-synced filter demo for VorzelaJs query param helpers.',
        name: 'description',
      },
    ],
    title: 'VorzelaJs | Filters',
  }),
  validateSearch: (search): FiltersSearch => ({
    featured: filterSearch.readBoolean(search, 'featured'),
    page: filterSearch.readPage(search, 'page'),
    q: filterSearch.readText(search, 'q'),
    sort: filterSearch.readSort(search, 'sort', SORT_OPTIONS, 'relevance'),
    tag: filterSearch.readArray(search, 'tag'),
  }),
  component: FiltersPage,
})

function FiltersPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const setSearch = Route.useSetSearch()

  const applyFilters = (nextFilters: Partial<FiltersSearch>, replace = true) => {
    const current = search()

    return setSearch({
      featured: filterSearch.boolean(nextFilters.featured ?? current.featured),
      page: filterSearch.page(nextFilters.page ?? current.page),
      q: filterSearch.text(nextFilters.q ?? current.q),
      sort: filterSearch.sort(nextFilters.sort ?? current.sort, 'relevance'),
      tag: filterSearch.array(nextFilters.tag ?? current.tag),
    }, { replace })
  }

  const toggleTag = (tag: string) => {
    const currentTags = search().tag
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((value) => value !== tag)
      : [...currentTags, tag]

    void applyFilters({ page: 1, tag: nextTags })
  }

  const goToPage = (page: number) => {
    const current = search()

    void navigate({
      search: {
        featured: filterSearch.boolean(current.featured),
        page: filterSearch.page(page),
        q: filterSearch.text(current.q),
        sort: filterSearch.sort(current.sort, 'relevance'),
        tag: filterSearch.array(current.tag),
      },
      to: '/filters',
    })
  }

  return (
    <section class="page-card">
      <p class="eyebrow">Search State</p>
      <h1>Shareable filters</h1>
      <p class="lead-copy">
        This route keeps filter state in the URL so the current view can be refreshed,
        copied, and shared as a deep link.
      </p>

      <div class="stack-list">
        <article class="stack-item">
          <h2>Search text</h2>
          <input
            type="search"
            placeholder="Type to update ?q="
            value={search().q}
            onInput={(event) => {
              void applyFilters({ page: 1, q: event.currentTarget.value })
            }}
          />
        </article>

        <article class="stack-item">
          <h2>Tags</h2>
          <div class="hero-actions">
            <button type="button" class="button button--secondary" onClick={() => toggleTag('alpha')}>
              Toggle alpha
            </button>
            <button type="button" class="button button--secondary" onClick={() => toggleTag('beta')}>
              Toggle beta
            </button>
          </div>
        </article>

        <article class="stack-item">
          <h2>Featured only</h2>
          <button
            type="button"
            class="button button--secondary"
            onClick={() => {
              void applyFilters({ featured: !search().featured, page: 1 })
            }}
          >
            {search().featured ? 'Disable featured filter' : 'Enable featured filter'}
          </button>
        </article>

        <article class="stack-item">
          <h2>Sort and page</h2>
          <div class="hero-actions">
            <button
              type="button"
              class="button button--ghost"
              onClick={() => {
                void applyFilters({ page: 1, sort: 'newest' })
              }}
            >
              Sort newest
            </button>
            <button type="button" class="button button--ghost" onClick={() => goToPage(search().page + 1)}>
              Next page via navigate({ '{' } search { '}' })
            </button>
            <button
              type="button"
              class="button button--ghost"
              onClick={() => {
                void setSearch({
                  featured: undefined,
                  page: undefined,
                  q: undefined,
                  sort: undefined,
                  tag: undefined,
                }, { replace: true })
              }}
            >
              Reset filters
            </button>
          </div>
        </article>

        <article class="stack-item">
          <h2>Current validated search</h2>
          <pre class="mono-note">{JSON.stringify(search(), null, 2)}</pre>
        </article>
      </div>
    </section>
  )
}