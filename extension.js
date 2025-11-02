const date = new Date();
date.setFullYear(date.getFullYear() + 6);
const MAX = new Date(date);
const MIN = new Date(2019, 0, 1);
const MONTH_NAMES = [
  "January","February","March","April","May","June","July","August","September","October","November","December"
];

(function ensureTeleportStyles() {
  if (document.getElementById("teleport-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "teleport-dialog-styles";
  style.textContent = `
    .teleport-dialog .bp4-overlay-backdrop,
    .teleport-dialog.bp4-overlay { z-index: 2147483647 !important; }
    .teleport-calendar-wrapper { display: flex; flex-direction: column; gap: 12px; }
    .teleport-calendar-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .teleport-calendar-controls label { display: flex; flex-direction: column; font-size: 11px; letter-spacing: 0.02em; text-transform: uppercase; }
    .teleport-calendar-controls select { margin-top: 2px; min-width: 120px; }
    .teleport-calendar-nav { border: 1px solid rgba(16,22,26,0.3); background: transparent; padding: 4px 8px; border-radius: 3px; font-size: 16px; line-height: 1; cursor: pointer; }
    .teleport-calendar-nav:disabled { opacity: 0.4; cursor: not-allowed; }
    .teleport-datepicker-hide-caption .bp4-datepicker-caption { display: none; }
  `;
  document.head.appendChild(style);
})();

const FormDialog = ({ onSubmit, title, onClose }) => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = window.React.useState(today);
  const dialogRef = window.React.useRef(null);
  const calendarRef = window.React.useRef(null);
  const monthSelectRef = window.React.useRef(null);
  const yearSelectRef = window.React.useRef(null);

  const focusSelectedDay = window.React.useCallback(() => {
    if (!calendarRef.current) return;
    const root = calendarRef.current;
    const buttons = root.querySelectorAll(".bp4-datepicker-day-wrapper button");
    for (let i = 0; i < buttons.length; i++) buttons[i].tabIndex = -1;
    const selected =
      root.querySelector(".bp4-datepicker-day-wrapper button.bp4-datepicker-day-selected") ||
      root.querySelector(".bp4-datepicker-day-wrapper button[aria-current=\"date\"]");
    if (selected && typeof selected.focus === "function") {
      selected.tabIndex = 0;
      try {
        selected.focus({ preventScroll: true });
      } catch {
        selected.focus();
      }
      return true;
    }
    return false;
  }, []);

  const focusDaySoon = window.React.useCallback(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (focusSelectedDay()) return;
      window.requestAnimationFrame(tick);
    };
    if (!focusSelectedDay()) {
      window.requestAnimationFrame(tick);
    }
    return () => {
      cancelled = true;
    };
  }, [focusSelectedDay]);

  const focusMonthSelect = window.React.useCallback(() => {
    const node = monthSelectRef.current;
    if (!node || node.disabled) return false;
    window.requestAnimationFrame(() => node.focus());
    return true;
  }, []);

  const focusYearSelect = window.React.useCallback(() => {
    const node = yearSelectRef.current;
    if (!node || node.disabled) return false;
    window.requestAnimationFrame(() => node.focus());
    return true;
  }, []);

  const years = window.React.useMemo(() => {
    const list = [];
    for (let y = MIN.getFullYear(); y <= MAX.getFullYear(); y += 1) list.push(y);
    return list;
  }, []);

  const monthValue = String(selectedDate.getMonth());
  const yearValue = String(selectedDate.getFullYear());

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

  window.React.useLayoutEffect(() => {
    const cancel = focusDaySoon();
    return typeof cancel === "function" ? cancel : undefined;
  }, [focusDaySoon, selectedDate]);

  const prevMonthDisabled = window.React.useMemo(() => {
    const probe = new Date(selectedDate);
    probe.setDate(1);
    probe.setMonth(probe.getMonth() - 1);
    return probe < MIN;
  }, [selectedDate]);

  const nextMonthDisabled = window.React.useMemo(() => {
    const probe = new Date(selectedDate);
    probe.setDate(1);
    probe.setMonth(probe.getMonth() + 1);
    return probe > MAX;
  }, [selectedDate]);

  const changeMonthBy = window.React.useCallback((delta) => {
    setSelectedDate((prev) => {
      const base = new Date(prev);
      const originalDay = prev.getDate();
      base.setDate(1);
      base.setMonth(base.getMonth() + delta);
      const safeDay = Math.min(originalDay, daysInMonth(base.getFullYear(), base.getMonth()));
      base.setDate(safeDay);
      return clampDateToRange(base);
    });
    focusDaySoon();
  }, [focusDaySoon]);

  const goPrevMonth = window.React.useCallback(() => changeMonthBy(-1), [changeMonthBy]);
  const goNextMonth = window.React.useCallback(() => changeMonthBy(1), [changeMonthBy]);

  const handleMonthChange = window.React.useCallback((event) => {
    const month = Number(event.target.value);
    if (Number.isNaN(month)) return;
    setSelectedDate((prev) => withYearMonth(prev, prev.getFullYear(), month));
    focusDaySoon();
  }, [focusDaySoon]);

  const handleYearChange = window.React.useCallback((event) => {
    const year = Number(event.target.value);
    if (Number.isNaN(year)) return;
    setSelectedDate((prev) => withYearMonth(prev, year, prev.getMonth()));
    focusDaySoon();
  }, [focusDaySoon]);

  const handleDayKeyDown = window.React.useCallback((day, modifiers, event) => {
    if (!event) return;
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      if (event.shiftKey) {
        if (!focusYearSelect()) focusDaySoon();
      } else if (!focusMonthSelect()) {
        focusDaySoon();
      }
      return;
    }
    const offset = offsets[event.key];
    if (!Number.isInteger(offset)) return;
    event.preventDefault();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset);
      return clampDateToRange(next);
    });
    focusDaySoon();
  }, [focusDaySoon, focusMonthSelect, focusYearSelect]);

  const dayPickerProps = window.React.useMemo(() => ({ onDayKeyDown: handleDayKeyDown }), [handleDayKeyDown]);

  const handleMonthKeyDown = window.React.useCallback((event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    event.currentTarget?.blur?.();
    if (event.shiftKey) {
      focusDaySoon();
    } else if (!focusYearSelect()) {
      focusDaySoon();
    }
  }, [focusDaySoon, focusYearSelect]);

  const handleYearKeyDown = window.React.useCallback((event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    event.currentTarget?.blur?.();
    if (event.shiftKey) {
      if (!focusMonthSelect()) focusDaySoon();
    } else {
      focusDaySoon();
    }
  }, [focusDaySoon, focusMonthSelect]);

  window.React.useEffect(() => {
    const handler = (event) => {
      if (!dialogRef.current) return;
      const root = dialogRef.current;
      if (!root.contains(event.target)) {
        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
          if (event.shiftKey) {
            if (!focusYearSelect()) focusDaySoon();
          } else if (!focusMonthSelect()) {
            focusDaySoon();
          }
          return;
        }
        const offsets = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -7,
          ArrowDown: 7,
        };
        const offset = offsets[event.key];
        if (Number.isInteger(offset)) {
          event.preventDefault();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
          setSelectedDate((prev) => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + offset);
            return clampDateToRange(next);
          });
          focusDaySoon();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [focusDaySoon, focusMonthSelect, focusYearSelect]);

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
      { className: window.Blueprint.Core.Classes.DIALOG_BODY, ref: dialogRef },
      window.React.createElement(
        "div",
        { className: "teleport-calendar-wrapper" },
        window.React.createElement(
          "div",
          { className: "teleport-calendar-controls" },
          window.React.createElement(
            "button",
            {
              type: "button",
              className: "teleport-calendar-nav",
              tabIndex: -1,
              disabled: prevMonthDisabled,
              onClick: goPrevMonth,
              "aria-label": "Previous month",
            },
            "‹"
          ),
          window.React.createElement(
            "label",
            {},
            "Month",
            window.React.createElement(
              "select",
              {
                ref: monthSelectRef,
                value: monthValue,
                onChange: handleMonthChange,
                onKeyDown: handleMonthKeyDown,
              },
              MONTH_NAMES.map((name, index) =>
                window.React.createElement("option", { key: name, value: String(index) }, name)
              )
            )
          ),
          window.React.createElement(
            "label",
            {},
            "Year",
            window.React.createElement(
              "select",
              {
                ref: yearSelectRef,
                value: yearValue,
                onChange: handleYearChange,
                onKeyDown: handleYearKeyDown,
                disabled: years.length <= 1,
              },
              years.map((year) =>
                window.React.createElement("option", { key: year, value: String(year) }, String(year))
              )
            )
          ),
          window.React.createElement(
            "button",
            {
              type: "button",
              className: "teleport-calendar-nav",
              tabIndex: -1,
              disabled: nextMonthDisabled,
              onClick: goNextMonth,
              "aria-label": "Next month",
            },
            "›"
          )
        ),
        window.React.createElement(
          "div",
          { className: "teleport-datepicker-hide-caption", ref: calendarRef },
            window.React.createElement(window.Blueprint.DateTime.DatePicker, {
              onChange,
              maxDate: MAX,
              minDate: MIN,
              highlightCurrentDay: true,
            popoverProps: { minimal: true, captureDismiss: true },
            value: selectedDate,
            canClearSelection: false,
            dayPickerProps,
          })
        )
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
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDateToRange(date) {
  if (date < MIN) return new Date(MIN);
  if (date > MAX) return new Date(MAX);
  return date;
}

function withYearMonth(base, year, monthIndex) {
  const safeDay = Math.min(base.getDate(), daysInMonth(year, monthIndex));
  const next = new Date(base);
  next.setFullYear(year, monthIndex, safeDay);
  return clampDateToRange(next);
}

function convertToRoamDate(dateString) {
  const [mm, dd, year] = dateString.split("-");
  const month = Number(mm);
  const day = Number(dd);
  const suffix = (day >= 4 && day <= 20) || (day >= 24 && day <= 30)
    ? "th" : ["st", "nd", "rd"][day % 10 - 1];
  return `${MONTH_NAMES[month - 1]} ${day}${suffix}, ${year}`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
