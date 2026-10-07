import { settings } from "@/config/settings";
import { Dashboard } from "@/components/Dashboard";

export default function Page() {
  return (
    <Dashboard
      brand={settings.brand}
      refreshSeconds={settings.refreshSeconds}
      weeksToShow={settings.weeksToShow}
    />
  );
}
