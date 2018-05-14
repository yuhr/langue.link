export const query = async (endpoint: string, body: object) => {
  const tokenset = JSON.parse(localStorage.getItem('tokenset')!)
  const me = await fetch(endpoint, {
    method: body ? 'post' : 'get',
    headers: {
      'Authorization': `Bearer ${tokenset.access_token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  return await me.json()
}