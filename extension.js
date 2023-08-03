const date = new Date();
date.setFullYear(date.getFullYear() + 6);
const MAX = new Date(date);
const MIN = new Date(2019, 0, 1);

const FormDialog = ({
    onSubmit,
    title,
    onClose,
}) => {
    var today = new Date;
    const [scheduleDate, setScheduleDate] = window.React.useState(today);

    const onChange = window.React.useCallback(
        (date) => {
            onSubmit(date);
            onClose();
        },
        [setScheduleDate, onClose]
    );
    const onCancel = window.React.useCallback(
        () => {
            onSubmit("");
            onClose();
        },
        [onClose]
    )
    return window.React.createElement(
        window.Blueprint.Core.Dialog,
        { isOpen: true, autoFocus: false, onClose: onCancel, title, },
        window.React.createElement(
            "div",
            { className: window.Blueprint.Core.Classes.DIALOG_BODY },
            window.React.createElement(
                window.Blueprint.Core.Label,
                {},
                window.React.createElement(
                    window.Blueprint.DateTime.DatePicker,
                    {
                        onChange: onChange,
                        maxDate: MAX,
                        minDate: MIN,
                        highlightCurrentDay: true,
                        popoverProps: {
                            minimal: true,
                            captureDismiss: true,
                        }
                    }
                )
            )
        )
    );
}

const prompt = ({
    title,
}) =>
    new Promise((resolve) => {
        const app = document.getElementById("app");
        const parent = document.createElement("div");
        parent.id = 'teleport-prompt-root';
        app.parentElement.appendChild(parent);

        window.ReactDOM.render(
            window.React.createElement(
                FormDialog,
                {
                    onSubmit: resolve,
                    title,
                    onClose: () => {
                        window.ReactDOM.unmountComponentAtNode(parent);
                        parent.remove();
                    },
                    "keyboard": {
                        "displayValue": false,
                        "value": false
                    }
                }
            ),
            parent
        )
    });

export default {
    onload: ({ extensionAPI }) => {
        extensionAPI.ui.commandPalette.addCommand({
            label: "Teleport TODOs",
            callback: () => teleport(),
        });
        window.roamAlphaAPI.ui.blockContextMenu.addCommand({
            label: "Teleport TODOs",
            callback: (e) => teleport(e),
        });
    },
    onunload: () => {
        window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
            label: "Teleport TODOs"
        });
    }
}

async function teleport(e) {
    let uidArray = [];
    const regex = /(\{\{\[\[TODO\]\]\}\})/;
    let uids = await roamAlphaAPI.ui.individualMultiselect.getSelectedUids(); // get multi-selection uids
    if (uids.length === 0) { // not using multiselect mode
        var uid, text;
        if (e) { // bullet right-click 
            uid = e["block-uid"].toString();
            text = e["block-string"].toString();
        } else { // command palette
            uid = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
            var texta = await window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uid]);
            text = texta[":block/string"];
        }
        if (regex.test(text)) { //there's a TODO in this single block
            uidArray.push({ uid })
        } else {
            alert("You can't teleport without selecting blocks")
            return;
        }
    } else { // multi-select mode, iterate blocks
        for (var i = 0; i < uids.length; i++) {
            var results = await window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uids[i]]);
            var refString = results[":block/string"];
            if (regex.test(refString)) { //there's a TODO in this single block
                let uid = uids[i].toString();
                uidArray.push({ uid })
            }
        }
    }

    if (uidArray.length > 0) { // there are blocks to move
        var selectedDate = await prompt({
            title: "To which date?",
        });
        if (selectedDate.length < 1) {
            return;
        }
        let year = selectedDate.getFullYear();
        var dd = String(selectedDate.getDate()).padStart(2, '0');
        var mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        let newDate = mm + "-" + dd + "-" + year;
        var titleDate = convertToRoamDate(newDate);
        var page = await window.roamAlphaAPI.q(`[:find (pull ?e [:node/title]) :where [?e :block/uid "${newDate}"]]`);
        if (page.length > 0 && page[0][0] != null) {
            // there's already a page with this date
        } else {
            await window.roamAlphaAPI.createPage({ page: { title: titleDate, uid: newDate } });
        }

        for (var j = 0; j < uidArray.length; j++) { // iterate and move block array to new date
            await window.roamAlphaAPI.moveBlock(
                {
                    location: { "parent-uid": newDate, order: j },
                    block: { uid: uidArray[j].uid.toString() }
                });
        }
        if (uids.length !== 0) { // was using multiselect mode, so turn it off
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: "m",
                keyCode: 77,
                code: "KeyM",
                which: 77,
                shiftKey: false,
                ctrlKey: true,
                metaKey: false
            }));
            window.dispatchEvent(new KeyboardEvent('keyup', {
                key: "m",
                keyCode: 77,
                code: "KeyM",
                which: 77,
                shiftKey: false,
                ctrlKey: true,
                metaKey: false
            }));
        }
    }
}

function convertToRoamDate(dateString) {
    var parsedDate = dateString.split('-');
    var year = parsedDate[2];
    var month = Number(parsedDate[0]);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var monthName = months[month - 1];
    var day = Number(parsedDate[1]);
    let suffix = (day >= 4 && day <= 20) || (day >= 24 && day <= 30)
        ? "th"
        : ["st", "nd", "rd"][day % 10 - 1];
    return "" + monthName + " " + day + suffix + ", " + year + "";
}