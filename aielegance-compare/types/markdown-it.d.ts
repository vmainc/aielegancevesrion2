declare module 'markdown-it' {
  class MarkdownIt {
    constructor (opts?: {
      html?: boolean
      linkify?: boolean
      breaks?: boolean
    })
    render (src: string): string
  }
  export default MarkdownIt
}
