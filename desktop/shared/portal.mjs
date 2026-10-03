// Dodo Payments customer-portal links. The license service and the desktop
// client both refuse anything else; native code repeats the same host check.
const hosts=['live.dodopayments.com','test.dodopayments.com','customer.dodopayments.com','test.customer.dodopayments.com'];
export function trustedPortal(value){try{const url=new URL(value);return typeof value==='string'&&value.length<=2048&&!/[\x00-\x1f]/.test(value)&&url.protocol==='https:'&&hosts.includes(url.hostname)&&!url.username&&!url.password&&!url.port;}catch{return false;}}
