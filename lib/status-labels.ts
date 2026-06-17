export function getOrderStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    DRAFT: 'ร่างคำสั่งซื้อ',
    PENDING_PAYMENT: 'รอชำระเงิน',
    PAYMENT_SUBMITTED: 'ส่งหลักฐานชำระเงินแล้ว',
    PENDING: 'รอตรวจสอบ',
    APPROVED: 'อนุมัติแล้ว',
    PAID: 'ชำระเงินแล้ว',
    SENT_TO_INSURER: 'ส่งให้บริษัทประกันแล้ว',
    INSURER_REVIEWING: 'บริษัทประกันกำลังตรวจสอบ',
    POLICY_APPROVED: 'อนุมัติกรมธรรม์แล้ว',
    POLICY_ISSUED: 'ออกกรมธรรม์แล้ว',
    REJECTED: 'ไม่อนุมัติ',
    CANCELLED: 'ยกเลิก'
  };

  return status ? labels[status] ?? status : '-';
}

export function getPaymentStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    UNPAID: 'ยังไม่ชำระเงิน',
    SLIP_SUBMITTED: 'ส่งสลิปแล้ว',
    CARD_FORM_SUBMITTED: 'ส่งเอกสารตัดบัตรแล้ว',
    AWAITING_TRANSFER: 'รอชำระผ่านช่องทางที่เลือก',
    PAID: 'ชำระเงินแล้ว',
    FAILED: 'ชำระเงินไม่สำเร็จ',
    REFUNDED: 'คืนเงินแล้ว'
  };

  return status ? labels[status] ?? status : '-';
}

export function getPaymentMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    BANK_TRANSFER: 'โอนเงินแนบสลิป',
    CARD_GATEWAY: 'จ่ายผ่านบัตร'
  };

  return method ? labels[method] ?? method : '-';
}

export function getEmailStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    QUEUED: 'รอส่ง',
    SENT: 'ส่งแล้ว',
    ERROR: 'ส่งไม่สำเร็จ',
    MISSING_RECIPIENT: 'ไม่มีอีเมลผู้รับ'
  };

  return status ? labels[status] ?? status : '-';
}

export function getEmailActionLabel(status: string | null | undefined) {
  if (status === 'ERROR') {
    return 'ส่งซ้ำ';
  }

  return 'ส่งอีเมล';
}

export function getStatusHistoryMessageLabel(message: string | null | undefined) {
  if (!message) {
    return '';
  }

  const exactLabels: Record<string, string> = {
    'Policy information submitted. Waiting for checkout.': 'กรอกข้อมูลกรมธรรม์แล้ว รอชำระเงิน',
    'Customer submitted a bank transfer slip.': 'ลูกค้าส่งสลิปโอนเงินแล้ว',
    'Customer selected card/gateway payment.': 'ลูกค้าเลือกจ่ายผ่านบัตร',
    'Customer submitted credit card authorization documents.': 'ลูกค้าส่งเอกสารตัดบัตรเครดิตแล้ว',
    'Provider email was added to the email outbox.': 'เพิ่มอีเมลบริษัทประกันเข้าคิวส่งแล้ว',
    'Provider email preview was added to the email outbox.': 'เพิ่มตัวอย่างอีเมลบริษัทประกันเข้าคิวส่งแล้ว',
    'Provider email outbox item was refreshed.': 'อัปเดตคิวอีเมลบริษัทประกันแล้ว',
    'Provider email could not be queued because provider email is missing.': 'ยังเพิ่มอีเมลเข้าคิวไม่ได้ เพราะไม่มีอีเมลบริษัทประกัน',
    'Provider email send was blocked because provider email is missing.': 'ส่งอีเมลไม่ได้ เพราะไม่มีอีเมลบริษัทประกัน',
    'Magic Link email preview was generated for the insurance provider.': 'สร้างตัวอย่างอีเมล Magic Link สำหรับบริษัทประกันแล้ว'
  };

  if (exactLabels[message]) {
    return exactLabels[message];
  }

  if (message.startsWith('Provider email was sent to ')) {
    return 'ส่งอีเมลบริษัทประกันแล้ว';
  }

  if (/^ส่งอีเมลบริษัทประกันไปที่ .+ แล้ว$/.test(message)) {
    return 'ส่งอีเมลบริษัทประกันแล้ว';
  }

  if (message.startsWith('Provider email send failed: ')) {
    return `ส่งอีเมลบริษัทประกันไม่สำเร็จ: ${message.replace('Provider email send failed: ', '')}`;
  }

  if (message.startsWith('Admin updated order status to ')) {
    return `แอดมินอัปเดตสถานะเป็น ${getOrderStatusLabel(message.replace('Admin updated order status to ', ''))}`;
  }

  if (message.startsWith('Insurance provider updated status to ')) {
    return `บริษัทประกันอัปเดตสถานะเป็น ${getOrderStatusLabel(message.replace('Insurance provider updated status to ', ''))}`;
  }

  return message;
}

export function isCustomerVisibleStatusHistory(item: {
  message: string | null;
}) {
  const message = item.message ?? '';
  const label = getStatusHistoryMessageLabel(message);
  const searchableText = `${message} ${label}`.toLowerCase();
  const hiddenTerms = [
    'email outbox',
    'provider email',
    'magic link email preview',
    'magic link สำหรับบริษัทประกัน',
    'อีเมลบริษัทประกัน',
    'คิวส่ง',
    'คิวอีเมล'
  ];

  return !hiddenTerms.some((term) => searchableText.includes(term.toLowerCase()));
}
