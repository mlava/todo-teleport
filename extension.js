// todo-teleport — extension.js (stable dialog + prompt-first + BP DatePicker fix)

// ---- Date limits for DatePicker ----
const date = new Date();
date.setFullYear(date.getFullYear() + 6);
const MAX = new Date(date);
const MIN = new Date(2019, 0, 1);

// ---- One-time style injection to ensure dialog overlays Roam UI reliably ----
(function ensureTeleportStyles() {
  if (document.getElementById("teleport-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "teleport-dialog-styles";
  style.textContent = `
    /* Make sure the Blueprint overlay sits above Roam's own layers */
    .teleport-dialog .bp4-overlay-backdrop,
    .teleport-dialog.bp4-overlay { z-index: 9999 !important; }
  `;
  document.head.appendChild(style);
})();

// ---- React Dialog ----
const FormDialog = ({ onSubmit, title, onClose }) => {
  const today = new Date();

  const onChange = window.React.useCallback(
    (picked) => {
      // Clicking an already-selected day can emit null if clearing is allowed.
      if (!picked) return; // ignore "clear" events
      onSubmit(picked);
      onClose();
    },
    [onSubmit, onClose]
  );

  const onCancel = window.React.useCallback(() => {
    onSubmit(""); // sentinel for cancel
    onClose();
  }, [onSubmit, onClose]);

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
          // IMPORTANT: use uncontrolled defaultValue so the first click on "today" counts,
          // and prevent clearing to null by clicking the selected day.
          defaultValue: today,
          canClearSelection: false,
          // (Alternative if you prefer *no* preselection):
          // initialMonth: today,
          // defaultValue: undefined,
        })
      )
    )
  );
};

// ---- Prompt helper (singleton, never gets stuck) ----
const prompt = ({ title }) =>
  new Promise((resolve) => {
    // Prevent multiple prompts at once
    if (window.__teleportPromptOpen) return;
    window.__teleportPromptOpen = true;

    const parent = document.createElement("div");
    parent.id = "teleport-prompt-root";
    document.body.appendChild(parent);

    const safeClose = () => {
      try {
        if (parent.isConnected) {
          try {
            window.ReactDOM.unmountComponentAtNode(parent);
          } catch (_) {}
          parent.remove();
        }
      } finally {
        window.__teleportPromptOpen = false;
      }
    };

    try {
      window.ReactDOM.render(
        window.React.createElement(FormDialog, {
          onSubmit: resolve,
          title,
          onClose: safeClose,
        }),
        parent
      );
    } catch (err) {
      // If render fails for any reason, ensure we don't leave the guard stuck.
      console.error("[todo-teleport] Failed to render dialog:", err);
      safeClose();
    }
  });

// ---- Roam Depot entry points ----
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
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Teleport TODOs",
    });
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Teleport TODOs and leave blockref behind",
    });
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Teleport TODO date tag",
    });
  },
};

// ---- Main behaviour (prompt-first; then heavy pulls) ----
async function teleport(e, blockref, tag) {
  const regexTODO = /(\{\{\[\[TODO\]\]\}\})/i; // case-insensitive

  // 1) Collect candidate UIDs quickly (no pulls yet)
  const multiselectUids =
    (await roamAlphaAPI.ui.individualMultiselect.getSelectedUids?.()) || [];

  let candidateUids = [];
  if (multiselectUids.length > 0) {
    candidateUids = multiselectUids.map(String);
  } else {
    if (e) {
      const buid = e["block-uid"];
      if (!buid) return;
      candidateUids = [String(buid)];
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

  // 2) Prompt FIRST (fast paint; no heavy work yet)
  const selectedDate = await prompt({ title: "To which date?" });
  if (!selectedDate || !(selectedDate instanceof Date)) return;

  // 3) Compute target date strings
  const year = selectedDate.getFullYear();
  const dd = String(selectedDate.getDate()).padStart(2, "0");
  const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const newDate = `${mm}-${dd}-${year}`;
  const titleDate = convertToRoamDate(newDate);

  // Ensure target DNP page exists if we're going to move
  if (!tag) {
    const page = await window.roamAlphaAPI.q(
      `[:find (pull ?e [:node/title]) :where [?e :block/uid "${newDate}"]]`
    );
    if (!(page.length > 0 && page[0][0] != null)) {
      await window.roamAlphaAPI.createPage({ page: { title: titleDate, uid: newDate } });
    }
  }

  // 4) NOW do the heavy pulls for just the selected blocks
  const pulled = [];
  for (let i = 0; i < candidateUids.length; i++) {
    const uid = candidateUids[i];
    const info = await window.roamAlphaAPI.data.pull(
      "[:block/string :block/uid :block/order {:block/parents ...} {:block/children ...}]",
      [":block/uid", uid]
    );
    if (!info) continue;

    // find direct parent and original order
    let parentUid = null;
    const parents = info[":block/parents"] || [];
    for (let p = 0; p < parents.length; p++) {
      const kids = parents[p][":block/children"] || [];
      for (let k = 0; k < kids.length; k++) {
        if (kids[k][":block/uid"] === info[":block/uid"]) parentUid = parents[p][":block/uid"];
      }
    }

    pulled.push({
      uid: String(info[":block/uid"]),
      text: String(info[":block/string"] || ""),
      order: info[":block/order"] ?? 0,
      parent: parentUid,
    });
  }

  // 5) Keep only blocks that actually contain TODO
  const todoBlocks = pulled.filter((b) => regexTODO.test(b.text));
  if (todoBlocks.length === 0) {
    alert("No selected blocks contained {{[[TODO]]}}.");
    return;
  }

  if (tag) {
    // Change date TAG in string, leave block location unchanged
    const longMonth =
      /\[\[(?:January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2}(?:st|nd|rd|th),\s\d{4}\]\]/;
    const isoDate = /\[\[\d{4}-\d{2}-\d{2}\]\]/;

    for (let j = 0; j < todoBlocks.length; j++) {
      const src = String(todoBlocks[j].text);
      let replaced = src;

      if (longMonth.test(src)) {
        replaced = src.replace(longMonth, `[[${titleDate}]]`);
      } else if (isoDate.test(src)) {
        replaced = src.replace(isoDate, `[[${titleDate}]]`);
      } else {
        // If no existing date tag, keep behavior: do nothing
        continue;
      }

      await sleep(100);
      await window.roamAlphaAPI.updateBlock({
        block: { uid: todoBlocks[j].uid, string: replaced },
      });
    }
  } else {
    // Move block(s) to new DNP; optionally leave blockref behind
    for (let j = 0; j < todoBlocks.length; j++) {
      await window.roamAlphaAPI.moveBlock({
        location: { "parent-uid": newDate, order: j },
        block: { uid: String(todoBlocks[j].uid) },
      });
      if (blockref) {
        await window.roamAlphaAPI.createBlock({
          location: { "parent-uid": todoBlocks[j].parent, order: todoBlocks[j].order },
          block: { string: `((${String(todoBlocks[j].uid)}))` },
        });
      }
    }
  }

  // 6) Turn off multiselect if it was on
  if (multiselectUids.length !== 0) {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "m",
        keyCode: 77,
        code: "KeyM",
        which: 77,
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      })
    );
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "m",
        keyCode: 77,
        code: "KeyM",
        which: 77,
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      })
    );
  }
}

// ---- Helpers ----
function convertToRoamDate(dateString) {
  const parsedDate = dateString.split("-");
  const year = parsedDate[2];
  const month = Number(parsedDate[0]);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = months[month - 1];
  const day = Number(parsedDate[1]);
  const suffix =
    (day >= 4 && day <= 20) || (day >= 24 && day <= 30)
      ? "th"
      : ["st", "nd", "rd"][day % 10 - 1];
  return `${monthName} ${day}${suffix}, ${year}`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
