import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Assuming Dialog components are in ui/dialog
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import React, { useEffect, useState } from "react";

type ZapType = "UPZAP" | "DOWNZAP";

interface Zap {
  id: number;
  amount: number;
  type: ZapType;
  comment: string | null;
  createdAt: string;
}

interface ZapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: {
    amount: number; // Amount in sats
    zapType: ZapType;
    appId: number;
    comment?: string;
  }) => void;
  appName: string;
  appId: number;
}

const ZapModal: React.FC<ZapModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  appName,
  appId,
}) => {
  const [amountInSats, setAmountInSats] = useState<number | string>(21);
  const [zapType, setZapType] = useState<ZapType>("UPZAP");
  const [comment, setComment] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string or positive numbers
    if (value === "" || /^[1-9]\d*$/.test(value)) {
      setAmountInSats(value);
      setError(null); // Clear error on valid input
    } else if (value === "0") {
      setAmountInSats(value); // Allow typing 0 initially
      setError("Amount must be positive.");
    } else {
      // Keep the previous valid value or empty string if invalid input
      setAmountInSats(amountInSats);
    }
  };

  const setPresetAmount = (preset: number) => {
    setAmountInSats(preset);
    setError(null);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
  };

  const handleSubmit = () => {
    const numericAmount = Number(amountInSats);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    setError(null);
    onSubmit({
      amount: numericAmount,
      zapType,
      appId,
      comment: comment.trim() || undefined, // Send undefined if comment is empty
    });
  };

  // Reset state when dialog opens/closes to avoid stale data
  React.useEffect(() => {
    if (!isOpen) {
      setAmountInSats(21);
      setZapType("UPZAP");
      setComment("");
      setError(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Zap "{appName}"</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Zap Type Selection */}
          <div className="flex justify-center gap-2">
            <Button
              variant={zapType === "UPZAP" ? "default" : "outline"}
              onClick={() => setZapType("UPZAP")}
              style={
                zapType === "UPZAP"
                  ? { backgroundColor: "#facc15", color: "black" }
                  : {}
              }
            >
              Upzap 👍
            </Button>
            <Button
              variant={zapType === "DOWNZAP" ? "destructive" : "outline"}
              onClick={() => setZapType("DOWNZAP")}
            >
              Downzap 👎
            </Button>
          </div>

          {/* Amount Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount (sats)
            </Label>
            <Input
              id="amount"
              type="number" // Use number type for better mobile input
              min="1"
              step="1"
              value={amountInSats}
              onChange={handleAmountChange}
              className="col-span-3"
              placeholder="Enter amount in sats"
            />
          </div>
          {error && (
            <p className="col-span-4 text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          {/* Preset Amounts */}
          <div className="flex justify-center gap-2">
            {[21, 210, 2100].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => setPresetAmount(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>

          {/* Optional Comment */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="comment" className="text-right pt-2">
              Comment (optional)
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={handleCommentChange}
              className="col-span-3"
              placeholder="Add an optional comment..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!!error}>
            Generate Invoice
          </Button>
        </DialogFooter>
        {/* Zap History */}
        <ZapHistory appId={appId} />
      </DialogContent>
    </Dialog>
  );
};

interface ZapHistoryProps {
  appId: number;
}

const ZapHistory: React.FC<ZapHistoryProps> = ({ appId }) => {
  const [zapHistory, setZapHistory] = useState<Zap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZapHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/apps/${appId}/zaps`);
        if (!response.ok) {
          throw new Error("Failed to fetch zap history");
        }
        const data: Zap[] = await response.json();
        setZapHistory(data);
      } catch (error) {
        console.error(error);
        setError("Failed to load zap history");
      } finally {
        setLoading(false);
      }
    };

    fetchZapHistory();
  }, [appId]);

  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium mb-2">Recent Zaps</h3>
      {loading ? (
        <div className="text-center">Loading zap history...</div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : (
        <div>
          {zapHistory.length > 0 ? (
            <div className="space-y-2">
              {zapHistory.map((zap) => (
                <div key={zap.id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <span>
                      {zap.type === "UPZAP" ? "👍" : "👎"} {zap.amount} sats
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(zap.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {zap.comment && (
                    <p className="text-sm text-gray-600 mt-1">{zap.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No zaps yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ZapModal;
