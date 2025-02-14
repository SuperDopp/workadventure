import {
    AddSpaceUserMessage,
    BackToPusherSpaceMessage,
    PartialSpaceUser,
    RemoveSpaceUserMessage,
    SpaceUser,
    UpdateSpaceUserMessage,
} from "@workadventure/messages";
import Debug from "debug";
import { CustomJsonReplacerInterface } from "./CustomJsonReplacerInterface";
import { SpacesWatcher } from "./SpacesWatcher";

const debug = Debug("space");

export class Space implements CustomJsonReplacerInterface {
    readonly name: string;
    private users: Map<SpacesWatcher, Map<number, SpaceUser>>;

    constructor(name: string) {
        this.name = name;
        this.users = new Map<SpacesWatcher, Map<number, SpaceUser>>();
        debug(`${name} => created`);
    }

    public addUser(watcher: SpacesWatcher, spaceUser: SpaceUser) {
        const usersList = this.usersList(watcher);
        usersList.set(spaceUser.id, spaceUser);
        this.notifyWatchers(watcher, {
            message: {
                $case: "addSpaceUserMessage",
                addSpaceUserMessage: AddSpaceUserMessage.fromPartial({
                    spaceName: this.name,
                    user: spaceUser,
                }),
            },
        });
        debug(`${this.name} : user => added ${spaceUser.id}`);
    }
    public updateUser(watcher: SpacesWatcher, spaceUser: PartialSpaceUser) {
        const usersList = this.usersList(watcher);
        const user = usersList.get(spaceUser.id);
        if (user) {
            if (spaceUser.tags.length > 0) {
                user.tags = spaceUser.tags;
            }
            if (spaceUser.name) {
                user.name = spaceUser.name;
            }
            if (spaceUser.playUri) {
                user.playUri = spaceUser.playUri;
            }
            if (spaceUser.color) {
                user.color = spaceUser.color;
            }
            if (spaceUser.characterLayers.length > 0) {
                user.characterLayers = spaceUser.characterLayers;
            }
            if (spaceUser.isLogged !== undefined) {
                user.isLogged = spaceUser.isLogged;
            }
            if (spaceUser.availabilityStatus !== undefined) {
                user.availabilityStatus = spaceUser.availabilityStatus;
            }
            if (spaceUser.roomName) {
                user.roomName = spaceUser.roomName;
            }
            if (spaceUser.visitCardUrl) {
                user.visitCardUrl = spaceUser.visitCardUrl;
            }
            if (spaceUser.screenSharing !== undefined) {
                user.screenSharing = spaceUser.screenSharing;
            }
            if (spaceUser.microphoneState !== undefined) {
                user.microphoneState = spaceUser.microphoneState;
            }
            if (spaceUser.cameraState !== undefined) {
                user.cameraState = spaceUser.cameraState;
            }
            if (spaceUser.megaphoneState !== undefined) {
                user.megaphoneState = spaceUser.megaphoneState;
            }
            if (spaceUser.jitsiParticipantId) {
                user.jitsiParticipantId = spaceUser.jitsiParticipantId;
            }
            if (spaceUser.uuid) {
                user.uuid = spaceUser.uuid;
            }
            usersList.set(spaceUser.id, user);
            this.notifyWatchers(watcher, {
                message: {
                    $case: "updateSpaceUserMessage",
                    updateSpaceUserMessage: UpdateSpaceUserMessage.fromPartial({
                        spaceName: this.name,
                        user: spaceUser,
                    }),
                },
            });
            debug(`${this.name} : user => updated ${spaceUser.id}`);
        }
    }
    public removeUser(watcher: SpacesWatcher, id: number) {
        const usersList = this.usersList(watcher);
        usersList.delete(id);

        this.notifyWatchers(watcher, {
            message: {
                $case: "removeSpaceUserMessage",
                removeSpaceUserMessage: RemoveSpaceUserMessage.fromPartial({
                    spaceName: this.name,
                    userId: id,
                }),
            },
        });
        debug(`${this.name} : user => removed ${id}`);
    }

    public addWatcher(watcher: SpacesWatcher) {
        this.users.set(watcher, new Map<number, SpaceUser>());
        debug(`Space ${this.name} => watcher added ${watcher.id}`);
        for (const spaceUsers of this.users.values()) {
            for (const spaceUser of spaceUsers.values()) {
                watcher.write({
                    message: {
                        $case: "addSpaceUserMessage",
                        addSpaceUserMessage: AddSpaceUserMessage.fromPartial({
                            spaceName: this.name,
                            user: spaceUser,
                        }),
                    },
                });
            }
        }
    }
    public removeWatcher(watcher: SpacesWatcher) {
        this.users.delete(watcher);
        debug(`${this.name} => watcher removed ${watcher.id}`);
    }

    private notifyWatchers(watcher: SpacesWatcher, message: BackToPusherSpaceMessage) {
        for (const watcher_ of this.users.keys()) {
            if (watcher_.id !== watcher.id) {
                watcher_.write(message);
            }
        }
    }

    public canBeDeleted(): boolean {
        return this.users.size === 0;
    }

    private usersList(watcher: SpacesWatcher): Map<number, SpaceUser> {
        const usersList = this.users.get(watcher);
        if (!usersList) {
            throw new Error("No users list associated to the watcher");
        }
        return usersList;
    }

    public customJsonReplacer(key: unknown, value: unknown): string | undefined {
        // TODO : Better way to display date in the /dump
        if (key === "name") {
            return this.name;
        } else if (key === "users") {
            return `Users : ${this.users.size}`;
        }
        return undefined;
    }
}
