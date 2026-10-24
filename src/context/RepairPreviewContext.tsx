import React, { createContext, useContext, useState, ReactNode } from "react";

type RepairPreviewContextType = {
  previewEventId: string | null;
  previewStatus: "reconnected" | null;
  sharedTakeawayNote: string | null;
  sharedTakeawayTag: string | null;
  hasSharedTakeaway: boolean;
  setReconnectedPreview: (eventId: string) => void;
  setSharedTakeaway: (note: string, tag: string | null) => void;
  clearRepairPreview: () => void;
};

const RepairPreviewContext = createContext<RepairPreviewContextType>({
  previewEventId: null,
  previewStatus: null,
  sharedTakeawayNote: null,
  sharedTakeawayTag: null,
  hasSharedTakeaway: false,
  setReconnectedPreview: () => {},
  setSharedTakeaway: () => {},
  clearRepairPreview: () => {},
});

export function RepairPreviewProvider({ children }: { children: ReactNode }) {
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"reconnected" | null>(null);
  const [sharedTakeawayNote, setSharedTakeawayNote] = useState<string | null>(
    null,
  );
  const [sharedTakeawayTag, setSharedTakeawayTag] = useState<string | null>(
    null,
  );
  const [hasSharedTakeaway, setHasSharedTakeaway] = useState<boolean>(false);

  const setReconnectedPreview = (eventId: string) => {
    setPreviewEventId(eventId);
    setPreviewStatus("reconnected");
  };

  const setSharedTakeaway = (note: string, tag: string | null) => {
    setSharedTakeawayNote(note);
    setSharedTakeawayTag(tag);
    setHasSharedTakeaway(true);
  };

  const clearRepairPreview = () => {
    setPreviewEventId(null);
    setPreviewStatus(null);
    setSharedTakeawayNote(null);
    setSharedTakeawayTag(null);
    setHasSharedTakeaway(false);
  };

  return (
    <RepairPreviewContext.Provider
      value={{
        previewEventId,
        previewStatus,
        sharedTakeawayNote,
        sharedTakeawayTag,
        hasSharedTakeaway,
        setReconnectedPreview,
        setSharedTakeaway,
        clearRepairPreview,
      }}
    >
      {children}
    </RepairPreviewContext.Provider>
  );
}

export function useRepairPreview() {
  return useContext(RepairPreviewContext);
}
