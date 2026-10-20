const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import ExportExcelModal from "@/components/ExportExcelModal";',
  'import ExportExcelModal from "@/components/ExportExcelModal";\nimport ReturnsView from "@/components/ReturnsView";\nimport CustomersView from "@/components/CustomersView";'
);

// 2. Change mainView type
content = content.replace(
  'const [mainView, setMainView] = useState<"workspace" | "dashboard">("workspace");',
  'const [mainView, setMainView] = useState<"workspace" | "dashboard" | "returns" | "customers">("workspace");'
);

// 3. Add buttons
const targetBtns = '<span>Dashboard</span>\n                </button>\n              </div>';
const targetBtnsCRLF = '<span>Dashboard</span>\r\n                </button>\r\n              </div>';

const newBtns = `<span>Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMainView("returns")}
                  className={\`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer \${
                    mainView === "returns"
                      ? (isDarkMode ? "bg-amber-500 text-black shadow-sm" : "bg-amber-600 text-white shadow-sm")
                      : (isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-700 hover:text-black")
                  }\`}
                >
                  <span>⚠️</span>
                  <span>Retur & Komplain</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMainView("customers")}
                  className={\`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer \${
                    mainView === "customers"
                      ? (isDarkMode ? "bg-indigo-500 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm")
                      : (isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-700 hover:text-black")
                  }\`}
                >
                  <span>🏥</span>
                  <span>Master Customer</span>
                </button>
              </div>`;

if (content.includes(targetBtnsCRLF)) {
  content = content.replace(targetBtnsCRLF, newBtns.replace(/\n/g, '\r\n'));
} else {
  content = content.replace(targetBtns, newBtns);
}

// 4. Render views
const targetView = '{mainView === "dashboard" ? (';
const newView = `{mainView === "returns" ? (
          <ReturnsView onSelectInvoice={(inv) => { setSearchQuery(inv); setMainView("workspace"); }} onSelectCustomer={(c) => { setSearchQuery(c); setMainView("workspace"); }} />
        ) : mainView === "customers" ? (
          <CustomersView onSelectCustomerForFilter={(c) => { setSearchQuery(c); setMainView("workspace"); }} />
        ) : mainView === "dashboard" ? (`;

content = content.replace(targetView, newView);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched fantastic-order/app/page.tsx');
