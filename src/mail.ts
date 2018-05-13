import mailer from 'nodemailer'

const transporter = mailer.createTransport({
  host: 'smtp',
  port: 465,
  secure: true,
  auth: {
    user: 'noreply@langue.link',
    pass: 'noreply'
  }
}, {
  from: 'noreply@langue.link',
  subject: 'test sendmail',
  html: 'Mail of test sendmail'
})

export default transporter