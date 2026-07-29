const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)

    if (response.status !== 404 || request.method !== 'GET') {
      return response
    }

    const acceptsHtml = request.headers.get('accept')?.includes('text/html')
    if (!acceptsHtml) return response

    const fallbackUrl = new URL('/index.html', request.url)
    const fallbackRequest = new Request(fallbackUrl, {
      headers: request.headers,
      method: 'GET',
    })

    return env.ASSETS.fetch(fallbackRequest)
  },
}

export default worker
