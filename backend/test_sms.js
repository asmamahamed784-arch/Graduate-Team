
import 'dotenv/config';
import { sendSms } from './services/smsLogService.js';
sendSms({ recipient: '613479808', message: 'NQS OTP: 123456' })
  .then(res => console.log('Result:', res))
  .catch(console.error)
  .finally(() => process.exit(0));

