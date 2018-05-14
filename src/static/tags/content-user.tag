<content-user data-is="content">
  <view />
  <script>
    import { query } from '../query'
    import * as riot from 'riot'
    this.on('mount', async () => {
      let userinfo
      try {
        userinfo = await query('/api/oidc/me')
      } catch (err) {
        riot.mount('view', 'view-login')
      }
      riot.mount('view', 'view-user', { userinfo })
    })
  </script>
</content-user>
