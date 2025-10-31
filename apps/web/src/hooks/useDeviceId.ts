import { useEffect, useState } from "react";

const STORAGE_KEY = "judada:deviceId";

const requestDeviceId = async (): Promise<string> => {
  const response = await fetch("/api/device", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to create device");
  }
  const data = await response.json();
  return data.deviceId as string;
};

export const useDeviceId = () => {
  const [deviceId, setDeviceId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (!deviceId) {
      requestDeviceId()
        .then(id => {
          localStorage.setItem(STORAGE_KEY, id);
          setDeviceId(id);
        })
        .catch(error => {
          // eslint-disable-next-line no-console
          console.error("Unable to init device", error);
        });
    }
  }, [deviceId]);

  return deviceId;
};
