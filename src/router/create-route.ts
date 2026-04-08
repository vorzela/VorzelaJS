import { useSearch, useSetSearch } from './runtime'

import type {
  FileRouteDefinition,
  FileRouteOptions,
  RouteSearch,
  RootRouteDefinition,
  RootRouteOptions,
} from './types'

type InferValidatedSearch<Options> = Options extends {
  validateSearch: (...args: any[]) => infer Search
}
  ? Search extends RouteSearch
    ? Search
    : RouteSearch
  : RouteSearch

export function createRootRoute<LoaderData = unknown>() {
  return <const Options extends RootRouteOptions<LoaderData, any>>(
    options: Options,
  ): RootRouteDefinition<LoaderData, InferValidatedSearch<Options>> => ({
    kind: 'root',
    options,
    useSearch: () => useSearch<InferValidatedSearch<Options>>(),
    useSetSearch: () => useSetSearch<InferValidatedSearch<Options>>(),
  })
}

export function createFileRoute<const Path extends string>(path: Path) {
  return <
    LoaderData = unknown,
    const Options extends FileRouteOptions<Path, LoaderData, any> = FileRouteOptions<Path, LoaderData, RouteSearch>,
  >(
    options: Options,
  ): FileRouteDefinition<Path, LoaderData, InferValidatedSearch<Options>> => ({
    kind: 'file',
    options,
    path,
    useSearch: () => useSearch<InferValidatedSearch<Options>>(),
    useSetSearch: () => useSetSearch<InferValidatedSearch<Options>>(),
  })
}