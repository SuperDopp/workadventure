import { derived, writable } from "svelte/store";
import { Subject } from "rxjs";
import { FileExt, UploadedFile, uploadingState } from "../Services/FileMessageManager";
import { User } from "../Xmpp/AbstractRoom";
import { Message } from "../Model/Message";
import { mucRoomsStore } from "./MucRoomsStore";
import { userStore } from "./LocalUserStore";

// Global config store for the whole chat
export const enableChat = writable<boolean>(true);
export const enableChatUpload = writable<boolean>(false);
export const enableChatOnlineListStore = writable<boolean>(false);
export const enableChatDisconnectedListStore = writable<boolean>(false);

const _newChatMessageSubject = new Subject<string>();
export const newChatMessageSubject = _newChatMessageSubject.asObservable();

export const _newChatMessageWritingStatusSubject = new Subject<number>();
export const newChatMessageWritingStatusSubject = _newChatMessageWritingStatusSubject.asObservable();

export enum ChatMessageTypes {
    text = 1,
    me,
    userIncoming,
    userOutcoming,
    userWriting,
    userStopWriting,
}

export interface ChatMessage {
    type: ChatMessageTypes;
    date: Date;
    author?: User;
    targets?: User[];
    text?: string[];
    authorName?: string;
}

interface ChatGroup {
    messages: ChatMessage[];
    users: User[];
}

function createChatMessagesStore() {
    const { subscribe, update } = writable<ChatGroup>({ messages: [], users: [] });

    return {
        subscribe,
        addIncomingUser(user: User) {
            update((chatGroup) => {
                chatGroup.messages.push({
                    type: ChatMessageTypes.userIncoming,
                    targets: [user],
                    date: new Date(),
                });
                chatGroup.users.push(user);
                return chatGroup;
            });
        },
        addOutcomingUser(user: User) {
            update((chatGroup) => {
                chatGroup.messages.push({
                    type: ChatMessageTypes.userOutcoming,
                    targets: [user],
                    date: new Date(),
                });
                for (let i = 0; i < chatGroup.users.length; i++) {
                    if (chatGroup.users[i].name == user.name) {
                        chatGroup.users.splice(i, 1);
                        break;
                    }
                }
                return chatGroup;
            });
        },
        addPersonalMessage(text: string) {
            _newChatMessageSubject.next(text);
            update((chatGroup) => {
                console.log("chat.Stores.ChatStore.addPersonalMessage:", text);
                console.log("====================================");
                const defaultRoom = mucRoomsStore.getDefaultRoom();
                chatGroup.messages.push({
                    type: ChatMessageTypes.me,
                    text: [text],
                    author: defaultRoom ? defaultRoom.getUserByJid(defaultRoom.myJID) : undefined,
                    date: new Date(),
                    authorName: userStore.get().name,
                });
                return chatGroup;
            });
        },
        /**
         * @param origin The iframe that originated this message (if triggered from the Scripting API), or undefined otherwise.
         */
        addExternalMessage(user: User | undefined, text: string, authorName?: string, origin?: Window) {
            console.log("chat.Stores.Chatstores.addExternalMessage: ", text);
            update((chatGroup) => {
                chatGroup.messages.push({
                    type: ChatMessageTypes.text,
                    text: [text],
                    author: user,
                    date: new Date(),
                    authorName,
                });
                return chatGroup;
            });
        },

        reInitialize() {
            update(() => {
                return { messages: [], users: [] };
            });
        },
    };
}
export const chatMessagesStore = createChatMessagesStore();

function createChatSubMenuVisibilityStore() {
    const { subscribe, update } = writable<string>("");

    return {
        subscribe,
        openSubMenu(playerName: string, index: number) {
            const id = playerName + index;
            update((oldValue) => {
                return oldValue === id ? "" : id;
            });
        },
    };
}
export const chatSubMenuVisibilityStore = createChatSubMenuVisibilityStore();

export const chatVisibilityStore = writable<boolean>(false);

export const availabilityStatusStore = writable<number>(1);

export const timelineActiveStore = writable<boolean>(false);

export const lastTimelineMessageRead = writable<Date>(new Date());

export const writingStatusMessageStore = writable<Set<string>>(new Set<string>());

export const chatInputFocusStore = writable(false);

export const chatPeerConnectionInProgress = writable<boolean>(false);

export const mentionsUserStore = writable<Set<User>>(new Set<User>());
export const selectedMessageToReply = writable<Message | null>(null);
export const selectedMessageToReact = writable<Message | null>(null);
export const timelineMessagesToSee = derived(
    [chatMessagesStore, lastTimelineMessageRead],
    ([$chatMessagesStore, $lastTimelineMessageRead]) =>
        $chatMessagesStore.messages.filter((message) => message.date > $lastTimelineMessageRead).length
);

export const filesUploadStore = writable<Map<string, UploadedFile | FileExt>>(
    new Map<string, UploadedFile | FileExt>()
);
export const hasErrorUploadingFile = derived([filesUploadStore], ([$filesUploadStore]) =>
    [...$filesUploadStore.values()].reduce(
        (value, file) => (file.uploadState === uploadingState.error ? true : value),
        false
    )
);
export const hasInProgressUploadingFile = derived([filesUploadStore], ([$filesUploadStore]) =>
    [...$filesUploadStore.values()].reduce(
        (value, file) => (file.uploadState === uploadingState.inprogress ? true : value),
        false
    )
);

export const chatSoundsStore = writable<boolean>(true);
export const chatNotificationsStore = writable<boolean>(true);

export const connectionNotAuthorizedStore = writable<boolean>(false);
export const connectionEstablishedStore = writable<boolean>(false);

export const navChat = writable<string>("chat");

export const shownRoomListStore = writable<string>("");
export const showChatZonesStore = writable<boolean>(false);
export const showForumsStore = writable<boolean>(false);
export const showTimelineStore = writable<boolean>(false);
