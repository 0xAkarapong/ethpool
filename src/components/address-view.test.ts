import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TransferSection } from './address-view'

describe('address transfer list', () => {
  test('a failed history is a retry, not an empty list', () => {
    const html = renderToStaticMarkup(
      createElement(TransferSection, {
        historyMessage: 'Could not reach Ethereum',
        transfers: [],
        onRetry: () => {},
      }),
    )
    expect(html).toContain('Could not reach Ethereum')
    expect(html).toContain('Retry')
    expect(html).not.toContain('No ETH transfers in the recent window.')
  })

  test('an empty window says there were no transfers', () => {
    const html = renderToStaticMarkup(
      createElement(TransferSection, {
        historyMessage: null,
        transfers: [],
        onRetry: () => {},
      }),
    )
    expect(html).toContain('No ETH transfers in the recent window.')
    expect(html).not.toContain('Retry')
  })
})
