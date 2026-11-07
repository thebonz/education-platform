export type ReviewStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
export const REVIEW_LABEL: Record<ReviewStatus, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', CHANGES_REQUESTED: 'Cần sửa' };
