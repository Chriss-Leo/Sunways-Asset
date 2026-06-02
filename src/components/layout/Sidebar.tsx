import { useRouter } from "next/router";
import { useT } from "@/i18n";

interface NavItem {
  path: string;
  labelKey: string;
  descKey: string;
}

const navItems: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", descKey: "nav.dashboardDesc" },
  { path: "/platform", labelKey: "nav.platform", descKey: "nav.platformDesc" },
  { path: "/platform/files", labelKey: "nav.files", descKey: "nav.filesDesc" },
  { path: "/assets", labelKey: "nav.assets", descKey: "nav.assetsDesc" },
  { path: "/revenue", labelKey: "nav.revenue", descKey: "nav.revenueDesc" },
  { path: "/carbon", labelKey: "nav.carbon", descKey: "nav.carbonDesc" },
  { path: "/admin", labelKey: "nav.admin", descKey: "nav.adminDesc" },
];

function isActive(currentPath: string, itemPath: string) {
  return currentPath === itemPath;
}

export function Sidebar() {
  const { t } = useT();
  const router = useRouter();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(router.pathname, item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => router.push(item.path)}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                active
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              <p className="text-sm font-semibold">{t(item.labelKey)}</p>
              <p
                className={`mt-0.5 text-xs ${
                  active ? "text-zinc-400" : "text-zinc-400"
                }`}
              >
                {t(item.descKey)}
              </p>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 px-4 py-3">
        <p className="text-xs text-zinc-400">
          Sunways Asset v0.1
        </p>
      </div>
    </aside>
  );
}
