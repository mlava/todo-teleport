If you ever end your day with some of your {{[[TODO]]}} blocks in Roam still not {{[[DONE]]}}, this extension provides an easy way to send them to another daily note page to deal with then.

![todo-teleport](https://user-images.githubusercontent.com/6857790/202629194-29000be6-49c4-4657-b730-78056c29b8b6.gif)

## How to use

Using the Roam Research multi-block select (CTRL-m) choose the TODOs you want to teleport. If you only want to send one TODO to the future, feel free to skip this step!

You can trigger the teleport by right-clicking on the block's bullet icon and then selecting Plugins > Teleport TODOs. A datepicker dialogue box will come up. Choose the date and your TODOs will teleport to that page in your graph.

![image](https://user-images.githubusercontent.com/6857790/202837707-31590988-2831-4991-8f23-a756031e08d4.png)

You can also trigger this extension via the Command Palette and 'Teleport TODOs'.

If you happen to select a block that you've DONE, never fear as it won't be sent anywhere: only incomplete TODOs will move. Further, empty blocks or those that don't contain a {{[[TODO]]}} won't move either. No accidentally sending important data to another day!

## Commands

Three commands are available from both the Command Palette and the block context menu:

- **Teleport TODOs** — move TODO blocks to the chosen date's daily page
- **Teleport TODOs and leave blockref behind** — same as above, but leaves a block reference at the original location so you can still see where each TODO came from
- **Teleport TODO date tag** — replace an existing date tag (e.g. [[February 22nd, 2024]]) within the block text without moving the block to a different page

All commands support Roam Research Hotkeys and full keyboard control of the date picker (Tab, arrows, Enter, Escape).

## Chief of Staff integration

This extension exposes two tools to [Chief of Staff](https://github.com/mlava/chief-of-staff) via the Extension Tools API:

- **tt_move_todos** — programmatically move TODO blocks to a target daily page, optionally leaving block references behind
- **tt_replace_date_tag** — programmatically replace date tags in TODO blocks with a new date

If you have Chief of Staff installed, you can ask it to reschedule your TODOs and it will use these tools automatically.
