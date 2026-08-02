/**
 * Shared confirmation modal for strategy forms.
 * Shows a preview of the strategy parameters before final submission.
 */
export default function ConfirmModal({ open, title, children, onConfirm, onCancel, confirmText = '確認建立' }) {
  if (!open) return null

  return (
    <div className="sf-modal-overlay" onClick={onCancel}>
      <div className="sf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sf-modal-header">
          <h4 className="sf-modal-title">{title}</h4>
          <button className="sf-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="sf-modal-body">
          {children}
        </div>
        <div className="sf-modal-actions">
          <button type="button" className="sf-btn sf-btn-secondary" onClick={onCancel}>
            返回修改
          </button>
          <button type="button" className="sf-btn sf-btn-primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
