"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSelector } from "react-redux";
import {
  type SignerTron,
  SignerTronBuilder,
} from "@ledgerhq/device-signer-kit-tron";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";
import { selectOriginToken } from "@/state/settings/selectors";

type SignerTronContextType = {
  signer: SignerTron | null;
};

const initialState: SignerTronContextType = {
  signer: null,
};

const SignerTronContext = createContext<SignerTronContextType>(initialState);

export const SignerTronProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);
  const originToken = useSelector(selectOriginToken);

  const [signer, setSigner] = useState<SignerTron | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerTronBuilder({
      dmk,
      sessionId,
      originToken,
    }).build();
    setSigner(newSigner);
  }, [dmk, originToken, sessionId]);

  return (
    <SignerTronContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerTronContext.Provider>
  );
};

export const useSignerTron = (): SignerTron | null => {
  return useContext(SignerTronContext).signer;
};
