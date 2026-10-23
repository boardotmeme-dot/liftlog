import raw from './data/collections.json'

export interface Collection {
  id: string
  title: string
  description: string
  tags: string[]
  exercises: { slug: string; why: string }[]
}

export const collections = raw as Collection[]
