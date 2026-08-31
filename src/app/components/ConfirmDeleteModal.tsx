import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2 } from "lucide-react";

interface ConfirmDeleteModalProps {
  open: boolean;
  ar: boolean;
  title: string;
  itemName: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ open, ar, title, itemName, loading, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
            className="relative bg-background rounded-2xl border border-border/40 shadow-2xl p-6 w-full max-w-[400px]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="text-body-lg font-semibold">{title}</h3>
                <p className="text-caption text-muted-foreground">{ar ? "هذا الإجراء لا يمكن التراجع عنه" : "This action cannot be undone"}</p>
              </div>
            </div>
            <p className="text-body text-muted-foreground mb-6">
              {ar ? `هل أنت متأكد من حذف "${itemName}"؟` : `Are you sure you want to delete "${itemName}"?`}
            </p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50">
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button onClick={onConfirm} disabled={loading} className="flex-1 h-10 rounded-xl bg-destructive text-white text-body font-medium hover:bg-destructive disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 size={12} className="animate-spin" />}
                <Trash2 size={13} />
                {ar ? "احذف" : "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
