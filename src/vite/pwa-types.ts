export interface PwaIconDescriptor {
  sizes: string
  src: string
  type?: string
}

export interface VorzelaPwaOptions {
  backgroundColor?: string
  display?: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser'
  icons?: PwaIconDescriptor[]
  name?: string
  shortName?: string
  themeColor?: string
}

export interface ResolvedPwaConfig {
  backgroundColor: string
  display: string
  icons: PwaIconDescriptor[]
  name: string
  shortName: string
  themeColor: string
}
