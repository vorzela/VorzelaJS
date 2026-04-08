import type { Accessor, Component, JSX } from 'solid-js'

export type MaybePromise<T> = T | Promise<T>
export type RouterContextValue = Record<string, unknown>
export type RouteSearch = Record<string, unknown>
export type RouteSearchPrimitive = boolean | number | string | null | undefined
export type RouteSearchValue = RouteSearchPrimitive | RouteSearchPrimitive[]
export type RouteSearchInput = Record<string, RouteSearchValue>
export type RouteSearchUpdater<CurrentSearch extends RouteSearch = RouteSearch> =
  | RouteSearchInput
  | ((currentSearch: CurrentSearch) => RouteSearchInput)

export type RouteMode = 'client' | 'server-payload'
export type RouteErrorPhase = 'beforeLoad' | 'loader' | 'render' | 'validateSearch'

export interface NavigateToOptions<CurrentSearch extends RouteSearch = RouteSearch> {
  replace?: boolean
  scroll?: boolean
  search?: RouteSearchUpdater<CurrentSearch>
  to?: string
}

export interface SetSearchOptions {
  replace?: boolean
  scroll?: boolean
}

export type SetSearchFunction<CurrentSearch extends RouteSearch = RouteSearch> = (
  search: RouteSearchUpdater<CurrentSearch>,
  options?: SetSearchOptions,
) => Promise<void>

export interface MetaDescriptor {
  charset?: string
  content?: string
  httpEquiv?: string
  name?: string
  property?: string
}

export interface LinkDescriptor {
  as?: JSX.HTMLLinkAs
  crossorigin?: JSX.HTMLCrossorigin
  href: string
  rel: string
  type?: string
}

export interface HeadObject {
  links?: LinkDescriptor[]
  meta?: MetaDescriptor[]
  title?: string
}

export interface RouteErrorData {
  message: string
  name: string
  phase: RouteErrorPhase
  status: number
}

export interface RouteErrorContext {
  error: RouteErrorData
  reset: () => void
}

type ExtractPathParamNames<Path extends string> =
  Path extends `${string}$${infer Param}/${infer Rest}`
    ? Param extends ''
      ? ExtractPathParamNames<Rest>
      : Param | ExtractPathParamNames<Rest>
    : Path extends `${string}$${infer Param}`
      ? Param extends ''
        ? never
        : Param
      : never

export type RouteParams<Path extends string> =
  [ExtractPathParamNames<Path>] extends [never]
    ? Record<never, never>
    : { [Key in ExtractPathParamNames<Path>]: string }

export interface RouteLocation {
  href: string
  pathname: string
  search: string
  searchParams: URLSearchParams
}

export interface RouteComponentProps<
  Path extends string = string,
  LoaderData = unknown,
  Search extends RouteSearch = RouteSearch,
> {
  children?: JSX.Element
  loaderData: LoaderData
  params: RouteParams<Path>
  search: Search
}

export interface RouteLoaderContext<Path extends string, Search extends RouteSearch = RouteSearch> {
  context: RouterContextValue
  location: RouteLocation
  params: RouteParams<Path>
  pathname: string
  request: Request
  search: Search
}

export interface RouteHeadContext<
  Path extends string,
  LoaderData,
  Search extends RouteSearch = RouteSearch,
> {
  context: RouterContextValue
  location: RouteLocation
  loaderData: LoaderData
  params: RouteParams<Path>
  pathname: string
  search: Search
}

export interface RouteBeforeLoadContext<Path extends string, Search extends RouteSearch = RouteSearch> {
  context: RouterContextValue
  location: RouteLocation
  params: RouteParams<Path>
  pathname: string
  request: Request
  search: Search
}

export interface RouteAfterLoadContext<
  Path extends string,
  LoaderData,
  Search extends RouteSearch = RouteSearch,
> {
  context: RouterContextValue
  loaderData: LoaderData
  location: RouteLocation
  params: RouteParams<Path>
  pathname: string
  search: Search
}

export interface NotFoundState {
  handlerId: string | null
  targetId: string
}

export interface RouteErrorState {
  handlerId: string | null
  targetId: string
  error: RouteErrorData
}

export interface RouterCreateOptions {
  context?: RouterContextValue
}

export interface FileRouteOptions<Path extends string, LoaderData, Search extends RouteSearch> {
  afterLoad?: (context: RouteAfterLoadContext<Path, LoaderData, Search>) => MaybePromise<void>
  beforeLoad?: (context: RouteBeforeLoadContext<Path, Search>) => MaybePromise<unknown>
  component: Component<RouteComponentProps<Path, LoaderData, Search>>
  errorComponent?: Component<RouteErrorContext>
  head?: (context: RouteHeadContext<Path, LoaderData, Search>) => HeadObject
  loader?: (context: RouteLoaderContext<Path, Search>) => MaybePromise<LoaderData>
  mode?: RouteMode
  notFoundComponent?: Component
  validateSearch?: (search: RouteSearch) => Search
}

export interface RootRouteOptions<LoaderData, Search extends RouteSearch> {
  afterLoad?: (context: RouteAfterLoadContext<'/', LoaderData, Search>) => MaybePromise<void>
  beforeLoad?: (context: RouteBeforeLoadContext<'/', Search>) => MaybePromise<unknown>
  component: Component<RouteComponentProps<'/', LoaderData, Search>>
  errorComponent?: Component<RouteErrorContext>
  head?: (context: RouteHeadContext<'/', LoaderData, Search>) => HeadObject
  loader?: (context: RouteLoaderContext<'/', Search>) => MaybePromise<LoaderData>
  notFoundComponent?: Component
  validateSearch?: (search: RouteSearch) => Search
}

export interface RootRouteDefinition<LoaderData = unknown, Search extends RouteSearch = RouteSearch> {
  kind: 'root'
  options: RootRouteOptions<LoaderData, Search>
  useSearch: () => Accessor<Search>
  useSetSearch: () => SetSearchFunction<Search>
}

export interface FileRouteDefinition<
  Path extends string = string,
  LoaderData = unknown,
  Search extends RouteSearch = RouteSearch,
> {
  kind: 'file'
  options: FileRouteOptions<Path, LoaderData, Search>
  path: Path
  useSearch: () => Accessor<Search>
  useSetSearch: () => SetSearchFunction<Search>
}

export type AnyRouteDefinition = RootRouteDefinition<any, any> | FileRouteDefinition<any, any, any>

export interface RouteModuleImport {
  Route: unknown
}

export interface GeneratedRouteRecord {
  fullPath: string
  id: string
  importPath: string
  loadRoute: () => Promise<RouteModuleImport>
  matchPath: string | null
  parentId: string | null
  to: string
}

export interface ResolvedMatch {
  fullPath: string
  id: string
  loaderData: unknown
  mode: RouteMode
  params: Record<string, string>
  route: AnyRouteDefinition
  search: unknown
}

export interface ResolvedRouteState {
  head: HeadObject
  matches: ResolvedMatch[]
  notFound?: NotFoundState
  search: string
  routeError?: RouteErrorState
  pathname: string
  payloadHtml?: string
  renderSource: 'component' | 'payload'
}

export interface SerializedMatch {
  fullPath: string
  id: string
  loaderData: unknown
  mode: RouteMode
  params: Record<string, string>
  search: unknown
}

export interface BootstrapPayload {
  head: HeadObject
  matches: SerializedMatch[]
  notFound?: NotFoundState
  search: string
  routeError?: RouteErrorState
  pathname: string
}

export interface RoutePayloadEnvelope extends BootstrapPayload {
  html: string
  status: number
}

export interface RenderAssets {
  css: string[]
  js: string[]
}