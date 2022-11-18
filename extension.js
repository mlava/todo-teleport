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
        { isOpen: true, onClose: onCancel, title, },
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
                    }
                }
            ),
            parent
        )
    });

var myEventHandler = undefined;

export default {
    onload: ({ extensionAPI }) => {
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Teleport TODOs",
            callback: () => teleport(),
        });

        myEventHandler = function (e) {
            if (e.code === 'KeyT' && e.altKey && e.shiftKey) {
                e.preventDefault();
                getSelectionText();
            }
        }
        window.addEventListener('keydown', myEventHandler, false);
    },
    onunload: () => {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Teleport TODOs'
        });
        window.removeEventListener('keydown', myEventHandler, false);
    }
}

async function teleport() {
    let uidArray = [];
    const regex = /(\{\{\[\[TODO\]\]\}\})/;
    let uids = await roamAlphaAPI.ui.individualMultiselect.getSelectedUids(); // get multi-selection uids
    if (uids.length === 0) {
        let singleBlock = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        var results = await window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", singleBlock]);
        var refString = results[":block/string"];
        if (regex.test(refString)) { //there's a TODO in this single block
            uidArray.push({ singleBlock })
        } else {
            alert("You can't teleport without selecting blocks")
            return;
        }
    } else {
        for (var i = 0; i < uids.length; i++) {
            var results = await window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uids[i]]);
            var refString = results[":block/string"];
            if (regex.test(refString)) { //there's a TODO in this single block
                let uid = uids[i].toString();
                uidArray.push({ uid })
            }
        }
    }

    if (uidArray.length > 0) {
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

        for (var j = 0; j < uidArray.length; j++) {
            await window.roamAlphaAPI.moveBlock(
                {
                    location: { "parent-uid": newDate, order: j },
                    block: { uid: uidArray[j].uid.toString() }
                });
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