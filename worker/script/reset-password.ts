import { hashPassword } from '../src/auth'

const username = process.argv[2]
const newPassword = process.argv[3]

if (!username || !newPassword) {
  console.log('Usage: tsx reset-password.ts <username> <newPassword>')
  process.exit(1)
}

const hash = await hashPassword(newPassword)
console.log(hash)


// npx tsx worker/script/reset-password.ts admin 123

