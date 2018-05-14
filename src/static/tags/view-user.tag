<view-user>
  <table>
    <tbody>
      <tr each={ value, key in opts.userinfo  }>
        <th>{ key }</th>
        <td>{ value }</td>
      </tr>
    </tbody>
  </table>
  <style>
    th { text-align: right; }
    td { text-align: left; padding-left: 2mm; }
  </style>
  <script>
    console.log(opts.userinfo)
  </script>
</view-user>