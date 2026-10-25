import React, { createContext, useContext, useState, ReactNode } from "react";

export type ChallengeInvitationPreview = {
  id: string;
  idea: string;
  participant: "me" | "partner" | "both";
  timeframe: string;
  reward: string;
  creatorName: string;
  partnerName?: string;
  reframeTone?: string;
  reframeText?: string;
  shareReframe: boolean;
  status: "pending" | "accepted" | "declined" | "tweaked" | "completed";
  createdAt: string;
};

export type ShareInvitationInput = Omit<
  ChallengeInvitationPreview,
  "id" | "createdAt" | "status"
> & {
  id?: string;
  createdAt?: string;
  status?: ChallengeInvitationPreview["status"];
};

type ChallengePreviewContextType = {
  activeInvitation: ChallengeInvitationPreview | null;
  shareInvitation: (invitation: ShareInvitationInput) => void;
  updateInvitationStatus: (status: ChallengeInvitationPreview["status"]) => void;
  clearInvitation: () => void;
};

const ChallengePreviewContext = createContext<
  ChallengePreviewContextType | undefined
>(undefined);

export function ChallengePreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activeInvitation, setActiveInvitation] =
    useState<ChallengeInvitationPreview | null>(null);

  const shareInvitation = (invitation: ShareInvitationInput) => {
    const fullInvitation: ChallengeInvitationPreview = {
      id: invitation.id || Date.now().toString(),
      createdAt: invitation.createdAt || new Date().toISOString(),
      status: invitation.status || "pending",
      idea: invitation.idea,
      participant: invitation.participant,
      timeframe: invitation.timeframe,
      reward: invitation.reward,
      creatorName: invitation.creatorName,
      partnerName: invitation.partnerName,
      reframeTone: invitation.reframeTone,
      reframeText: invitation.reframeText,
      shareReframe: invitation.shareReframe,
    };
    setActiveInvitation(fullInvitation);
  };

  const updateInvitationStatus = (
    status: ChallengeInvitationPreview["status"]
  ) => {
    setActiveInvitation((prev) => (prev ? { ...prev, status } : null));
  };

  const clearInvitation = () => {
    setActiveInvitation(null);
  };

  return (
    <ChallengePreviewContext.Provider
      value={{
        activeInvitation,
        shareInvitation,
        updateInvitationStatus,
        clearInvitation,
      }}
    >
      {children}
    </ChallengePreviewContext.Provider>
  );
}

export function useChallengePreview(): ChallengePreviewContextType {
  const context = useContext(ChallengePreviewContext);
  if (!context) {
    throw new Error(
      "useChallengePreview must be used within a ChallengePreviewProvider"
    );
  }
  return context;
}
