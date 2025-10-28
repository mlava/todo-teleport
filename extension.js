const date = new Date();
date.setFullYear(date.getFullYear() + 6);
const MAX = new Date(date);
const MIN = new Date(2019, 0, 1);

(function ensureTeleportStyles() {
  if (document.getElementById("teleport-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "teleport-dialog-styles";
  style.textContent = `
    .teleport-dialog .bp4-overlay-backdrop,
    .teleport-dialog.bp4-overlay { z-index: 2147483647 !important; }
  `;
  document.head.appendChild(style);
})();

const FormDialog = ({ onSubmit, title, onClose }) => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = window.React.useState(today);

  const onChange = window.React.useCallback((picked) => {
    if (!picked) return;
    setSelectedDate(picked);
    onSubmit(picked);
    onClose();
  }, [onSubmit, onClose]);

  const onCancel = window.React.useCallback(() => {
    onSubmit("");
    onClose();
  }, [onSubmit, onClose]);

  window.React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        onSubmit(selectedDate);
        onClose();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onSubmit("");
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onSubmit, onClose, selectedDate]);

  return window.React.createElement(
    window.Blueprint.Core.Dialog,
    {
      isOpen: true,
      autoFocus: false,
      onClose: onCancel,
      title,
      usePortal: true,
      portalContainer: document.body,
      className: "teleport-dialog",
      canEscapeKeyClose: true,
      canOutsideClickClose: true,
    },
    window.React.createElement(
      "div",
      { className: window.Blueprint.Core.Classes.DIALOG_BODY },
      window.React.createElement(
        window.Blueprint.Core.Label,
        {},
        window.React.createElement(window.Blueprint.DateTime.DatePicker, {
          onChange,
          maxDate: MAX,
          minDate: MIN,
          highlightCurrentDay: true,
          popoverProps: { minimal: true, captureDismiss: true },
          value: selectedDate,
          canClearSelection: false,
        })
      )
    )
  );
};

const prompt = ({ title }) =>
  new Promise((resolve) => {
    if (window.__teleportPromptOpen) {
      resolve("");
      return;
    }
    window.__teleportPromptOpen = true;

    const parent = document.createElement("div");
    parent.id = "teleport-prompt-root";
    document.body.appendChild(parent);

    let settled = false;

    const cleanup = () => {
      try {
        if (parent.isConnected) {
          try { window.ReactDOM.unmountComponentAtNode(parent); } catch {}
          parent.remove();
        }
      } finally {
        window.__teleportPromptOpen = false;
      }
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    try {
      window.ReactDOM.render(
        window.React.createElement(FormDialog, {
          onSubmit: finish,
          title,
          onClose: () => finish(""),
        }),
        parent
      );
    } catch (err) {
      console.error("[todo-teleport] render failed:", err);
      finish("");
    }
  });
  
export default {
  onload: ({ extensionAPI }) => {
    extensionAPI.ui.commandPalette.addCommand({
      label: "Teleport TODOs",
      callback: () => teleport(null, false, false),
    });
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Teleport TODOs",
      callback: (e) => teleport(e, false, false),
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Teleport TODOs and leave blockref behind",
      callback: () => teleport(null, true, false),
    });
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Teleport TODOs and leave blockref behind",
      callback: (e) => teleport(e, true, false),
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Teleport TODO date tag",
      callback: () => teleport(null, false, true),
    });
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Teleport TODO date tag",
      callback: (e) => teleport(e, false, true),
    });
  },
  onunload: () => {
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({ label: "Teleport TODOs" });
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({ label: "Teleport TODOs and leave blockref behind" });
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({ label: "Teleport TODO date tag" });
  },
};

async function teleport(e, blockref, tag) {
  const regexTODO = /(\{\{\[\[TODO\]\]\}\})/i;
  
  const multiselectUids =
    (await roamAlphaAPI.ui.individualMultiselect.getSelectedUids?.()) || [];

  let candidateUids = [];
  if (multiselectUids.length > 0) {
    candidateUids = multiselectUids.map(String);
  } else {
    if (e && e["block-uid"]) {
      candidateUids = [String(e["block-uid"])];
    } else {
      const focused = await window.roamAlphaAPI.ui.getFocusedBlock();
      const fuid = focused && focused["block-uid"];
      if (!fuid) {
        alert("Place the cursor in the block you want to teleport first.");
        return;
      }
      candidateUids = [String(fuid)];
    }
  }
  if (candidateUids.length === 0) return;
  
  const selectedDate = await prompt({ title: "To which date?" });
  if (!selectedDate || !(selectedDate instanceof Date)) return;
  
  const year = selectedDate.getFullYear();
  const dd = String(selectedDate.getDate()).padStart(2, "0");
  const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const newDate = `${mm}-${dd}-${year}`;
  const titleDate = convertToRoamDate(newDate);
  
  if (!tag) {
    const page = await window.roamAlphaAPI.q(
      `[:find (pull ?e [:node/title]) :where [?e :block/uid "${newDate}"]]`
    );
    if (!(page.length > 0 && page[0][0] != null)) {
      await window.roamAlphaAPI.createPage({ page: { title: titleDate, uid: newDate } });
    }
  }
  
  if (tag) {
    const items = [];
    for (let i = 0; i < candidateUids.length; i++) {
      const uid = candidateUids[i];
      const info = await window.roamAlphaAPI.data.pull(
        "[:block/uid :block/string]",
        [":block/uid", uid]
      );
      if (!info) continue;
      const text = String(info[":block/string"] || "");
      if (regexTODO.test(text)) items.push({ uid, text });
    }

    if (items.length === 0) {
      alert("No selected blocks contained {{[[TODO]]}}.");
      return;
    }

    const longMonth =
      /\[\[(?:January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2}(?:st|nd|rd|th),\s\d{4}\]\]/;

    for (let j = 0; j < items.length; j++) {
      const src = items[j].text;
      if (!longMonth.test(src)) continue;
      const replaced = src.replace(longMonth, `[[${titleDate}]]`);
      await sleep(50);
      await window.roamAlphaAPI.updateBlock({"block": {"uid": items[j].uid, "string": replaced}});
    }
    
    return;
  }
  
  const todoBlocks = [];
  for (let i = 0; i < candidateUids.length; i++) {
    const uid = candidateUids[i];
    const info = await window.roamAlphaAPI.data.pull(
      "[:block/uid :block/string :block/order {:block/parents [:block/uid]}]",
      [":block/uid", uid]
    );
    if (!info) continue;

    const text = String(info[":block/string"] || "");
    if (!regexTODO.test(text)) continue;

    const order = info[":block/order"] ?? 0;
    const parents = (info[":block/parents"] || []);
    const directParent = parents.length ? parents[parents.length - 1][":block/uid"] : null;

    todoBlocks.push({
      uid,
      text,
      order,
      parent: directParent,
    });
  }

  if (todoBlocks.length === 0) {
    alert("No selected blocks contained {{[[TODO]]}}.");
    return;
  }
  
  for (let j = 0; j < todoBlocks.length; j++) {
    await window.roamAlphaAPI.moveBlock({
      location: { "parent-uid": newDate, order: j },
      block: { uid: String(todoBlocks[j].uid) },
    });

    if (blockref && todoBlocks[j].parent) {
      await window.roamAlphaAPI.createBlock({
        location: { "parent-uid": todoBlocks[j].parent, order: todoBlocks[j].order },
        block: { string: `((${String(todoBlocks[j].uid)}))` },
      });
    }
    await sleep(25);
  }
  
  if (multiselectUids.length !== 0) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", keyCode: 77, code: "KeyM", which: 77, ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "m", keyCode: 77, code: "KeyM", which: 77, ctrlKey: true }));
  }
}

// ---- Helpers ----
function convertToRoamDate(dateString) {
  const [mm, dd, year] = dateString.split("-");
  const month = Number(mm);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const day = Number(dd);
  const suffix = (day >= 4 && day <= 20) || (day >= 24 && day <= 30)
    ? "th" : ["st", "nd", "rd"][day % 10 - 1];
  return `${months[month - 1]} ${day}${suffix}, ${year}`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
