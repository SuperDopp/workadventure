import {
    PartialSpaceUser,
    PusherToBackSpaceMessage,
    RemoveSpaceFilterMessage,
    SpaceFilterMessage,
    SpaceUser,
    SubMessage,
    UpdateSpaceFilterMessage,
} from "@workadventure/messages";
import Debug from "debug";
import * as Sentry from "@sentry/node";
import { CustomJsonReplacerInterface } from "./CustomJsonReplacerInterface";
import { BackSpaceConnection, ExSocketInterface } from "./Websocket/ExSocketInterface";

type SpaceUserExtended = { lowercaseName: string } & SpaceUser;

const debug = Debug("space");

export class Space implements CustomJsonReplacerInterface {
    private readonly users: Map<number, SpaceUserExtended>;

    private clientWatchers: Map<number, ExSocketInterface>;

    constructor(
        public readonly name: string,
        private spaceStreamToPusher: BackSpaceConnection,
        public backId: number,
        watcher: ExSocketInterface
    ) {
        this.users = new Map<number, SpaceUserExtended>();
        this.clientWatchers = new Map<number, ExSocketInterface>();
        this.addClientWatcher(watcher);
        debug(`created : ${name}`);
    }

    public addClientWatcher(watcher: ExSocketInterface) {
        this.clientWatchers.set(watcher.userId, watcher);
        this.users.forEach((user) => {
            if (this.isWatcherTargeted(watcher, user)) {
                const filterOfThisSpace = watcher.spacesFilters.get(this.name) ?? [];
                const filtersTargeted = filterOfThisSpace.filter((spaceFilter) =>
                    this.filterOneUser(spaceFilter, user)
                );
                if (filtersTargeted.length > 0) {
                    filtersTargeted.forEach((spaceFilter) => {
                        this.notifyMeAddUser(watcher, user, spaceFilter.filterName);
                    });
                }
            }
        });
    }

    public removeClientWatcher(watcher: ExSocketInterface) {
        this.clientWatchers.delete(watcher.userId);
    }

    public addUser(spaceUser: SpaceUser) {
        const pusherToBackSpaceMessage: PusherToBackSpaceMessage = {
            message: {
                $case: "addSpaceUserMessage",
                addSpaceUserMessage: {
                    spaceName: this.name,
                    user: spaceUser,
                    filterName: undefined,
                },
            },
        };
        this.spaceStreamToPusher.write(pusherToBackSpaceMessage);
        debug(`${this.name} : user add sent ${spaceUser.id}`);
        this.localAddUser(spaceUser);
    }
    public localAddUser(spaceUser: SpaceUser) {
        const user = { ...spaceUser, lowercaseName: spaceUser.name.toLowerCase() };
        this.users.set(spaceUser.id, user);
        debug(`${this.name} : user added ${spaceUser.id}`);

        const subMessage: SubMessage = {
            message: {
                $case: "addSpaceUserMessage",
                addSpaceUserMessage: {
                    spaceName: this.name,
                    user: spaceUser,
                    filterName: undefined,
                },
            },
        };
        this.notifyAll(subMessage, user);
    }

    public updateUser(spaceUser: PartialSpaceUser) {
        const pusherToBackSpaceMessage: PusherToBackSpaceMessage = {
            message: {
                $case: "updateSpaceUserMessage",
                updateSpaceUserMessage: {
                    spaceName: this.name,
                    user: spaceUser,
                    filterName: undefined,
                },
            },
        };
        this.spaceStreamToPusher.write(pusherToBackSpaceMessage);
        debug(`${this.name} : user update sent ${spaceUser.id}`);
        this.localUpdateUser(spaceUser);
    }
    public localUpdateUser(spaceUser: PartialSpaceUser) {
        let oldUser: SpaceUserExtended | undefined;
        const user = this.users.get(spaceUser.id);
        if (user) {
            oldUser = structuredClone(user);
            if (spaceUser.tags.length > 0) {
                user.tags = spaceUser.tags;
            }
            if (spaceUser.name) {
                user.name = spaceUser.name;
                user.lowercaseName = spaceUser.name.toLowerCase();
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
            debug(`${this.name} : user updated ${spaceUser.id}`);

            const subMessage: SubMessage = {
                message: {
                    $case: "updateSpaceUserMessage",
                    updateSpaceUserMessage: {
                        spaceName: this.name,
                        user: spaceUser,
                        filterName: undefined,
                    },
                },
            };
            this.notifyAll(subMessage, user, oldUser);
        } else {
            console.error("User not found in this space", spaceUser);
        }
    }

    public removeUser(userId: number) {
        const pusherToBackSpaceMessage: PusherToBackSpaceMessage = {
            message: {
                $case: "removeSpaceUserMessage",
                removeSpaceUserMessage: {
                    spaceName: this.name,
                    userId,
                    filterName: undefined,
                },
            },
        };
        this.spaceStreamToPusher.write(pusherToBackSpaceMessage);
        debug(`${this.name} : user remove sent ${userId}`);
        this.localRemoveUser(userId);
    }
    public localRemoveUser(userId: number) {
        const user = this.users.get(userId);
        if (user) {
            this.users.delete(userId);
            debug(`${this.name} : user removed ${userId}`);

            const subMessage: SubMessage = {
                message: {
                    $case: "removeSpaceUserMessage",
                    removeSpaceUserMessage: {
                        spaceName: this.name,
                        userId,
                        filterName: undefined,
                    },
                },
            };
            this.notifyAll(subMessage, user);
        } else {
            console.error(`Space => ${this.name} : user not found ${userId}`);
            Sentry.captureException(`Space => ${this.name} : user not found ${userId}`);
        }
    }

    private notifyAll(subMessage: SubMessage, youngUser: SpaceUserExtended, oldUser: SpaceUserExtended | null = null) {
        this.clientWatchers.forEach((watcher) => {
            if (this.isWatcherTargeted(watcher, youngUser) || (oldUser && this.isWatcherTargeted(watcher, oldUser))) {
                const filterOfThisSpace = watcher.spacesFilters.get(this.name) ?? [];
                const filtersTargeted = filterOfThisSpace.filter(
                    (spaceFilter) =>
                        this.filterOneUser(spaceFilter, youngUser) ||
                        (oldUser && this.filterOneUser(spaceFilter, oldUser))
                );
                if (filtersTargeted.length > 0) {
                    filtersTargeted.forEach((spaceFilter) => {
                        if (subMessage.message?.$case === "addSpaceUserMessage") {
                            subMessage.message.addSpaceUserMessage.filterName = spaceFilter.filterName;
                            watcher.emitInBatch(subMessage);
                        } else if (subMessage.message?.$case === "updateSpaceUserMessage") {
                            if (
                                oldUser &&
                                !this.filterOneUser(spaceFilter, oldUser) &&
                                this.filterOneUser(spaceFilter, youngUser)
                            ) {
                                this.notifyMeAddUser(watcher, youngUser, spaceFilter.filterName);
                            } else if (
                                oldUser &&
                                this.filterOneUser(spaceFilter, oldUser) &&
                                !this.filterOneUser(spaceFilter, youngUser)
                            ) {
                                this.notifyMeRemoveUser(watcher, youngUser, spaceFilter.filterName);
                            } else {
                                subMessage.message.updateSpaceUserMessage.filterName = spaceFilter.filterName;
                                watcher.emitInBatch(subMessage);
                            }
                        } else if (subMessage.message?.$case === "removeSpaceUserMessage") {
                            subMessage.message.removeSpaceUserMessage.filterName = spaceFilter.filterName;
                            watcher.emitInBatch(subMessage);
                        }
                    });
                }
            }
        });
    }

    public notifyMe(watcher: ExSocketInterface, subMessage: SubMessage) {
        watcher.emitInBatch(subMessage);
    }

    private isWatcherTargeted(watcher: ExSocketInterface, user: SpaceUserExtended) {
        const filtersOfThisSpace = watcher.spacesFilters.get(this.name) ?? [];
        return filtersOfThisSpace.filter((spaceFilter) => this.filterOneUser(spaceFilter, user)).length > 0;
    }

    public filter(
        spaceFilter: SpaceFilterMessage,
        users: Map<number, SpaceUserExtended> | null = null
    ): Map<number, SpaceUserExtended> {
        const usersFiltered = new Map<number, SpaceUserExtended>();
        const usersToFilter = users ?? this.users;
        usersToFilter.forEach((user) => {
            if (this.filterOneUser(spaceFilter, user)) {
                usersFiltered.set(user.id, user);
            }
        });
        return usersFiltered;
    }

    private filterOneUser(spaceFilters: SpaceFilterMessage, user: SpaceUserExtended): boolean {
        if (!spaceFilters.filter) {
            Sentry.captureException("Empty filter received" + spaceFilters.spaceName);
            console.error("Empty filter received");
            return false;
        }

        switch (spaceFilters.filter.$case) {
            case "spaceFilterContainName": {
                const spaceFilterContainName = spaceFilters.filter.spaceFilterContainName;
                return user.lowercaseName.includes(spaceFilterContainName.value.toLowerCase());
            }
            case "spaceFilterEverybody": {
                return true;
            }
            case "spaceFilterLiveStreaming": {
                return (user.screenSharing || user.microphoneState || user.cameraState) && user.megaphoneState;
            }
            default: {
                const _exhaustiveCheck: never = spaceFilters.filter;
            }
        }
        return false;
    }

    public handleAddFilter(watcher: ExSocketInterface, updateSpaceFilterMessage: UpdateSpaceFilterMessage) {
        const newFilter = updateSpaceFilterMessage.spaceFilterMessage;
        if (newFilter) {
            debug(`${this.name} : filter added (${newFilter.filterName}) for ${watcher.userId}`);
            const newData = this.filter(newFilter);
            this.delta(watcher, this.users, newData, newFilter.filterName);
        }
    }

    public handleUpdateFilter(watcher: ExSocketInterface, updateSpaceFilterMessage: UpdateSpaceFilterMessage) {
        const newFilter = updateSpaceFilterMessage.spaceFilterMessage;
        if (newFilter) {
            const oldFilter = watcher.spacesFilters
                .get(this.name)
                ?.find((filter) => filter.filterName === newFilter.filterName);
            if (oldFilter) {
                debug(`${this.name} : filter updated (${newFilter.filterName}) for ${watcher.userId}`);
                const oldData = this.filter(oldFilter);
                const newData = this.filter(newFilter);
                this.delta(watcher, oldData, newData, newFilter.filterName);
            }
        }
    }

    public handleRemoveFilter(watcher: ExSocketInterface, removeSpaceFilterMessage: RemoveSpaceFilterMessage) {
        const oldFilter = removeSpaceFilterMessage.spaceFilterMessage;
        if (oldFilter) {
            debug(`${this.name} : filter removed (${oldFilter.filterName}) for ${watcher.userId}`);
            const oldData = this.filter(oldFilter);
            this.delta(watcher, oldData, this.users, undefined);
        }
    }

    private delta(
        watcher: ExSocketInterface,
        oldData: Map<number, SpaceUserExtended>,
        newData: Map<number, SpaceUserExtended>,
        filterName: string | undefined
    ) {
        let addedUsers = 0;
        // Check delta between responses by old and new filter
        newData.forEach((user) => {
            if (!oldData.has(user.id)) {
                this.notifyMeAddUser(watcher, user, filterName);
                addedUsers++;
            }
        });

        let removedUsers = 0;
        oldData.forEach((user) => {
            if (!newData.has(user.id)) {
                this.notifyMeRemoveUser(watcher, user, filterName);
                removedUsers++;
            }
        });

        debug(`${this.name} : filter calculated for ${watcher.userId} (${addedUsers} added, ${removedUsers} removed)`);
    }

    private notifyMeAddUser(watcher: ExSocketInterface, user: SpaceUserExtended, filterName: string | undefined) {
        const subMessage: SubMessage = {
            message: {
                $case: "addSpaceUserMessage",
                addSpaceUserMessage: {
                    spaceName: this.name,
                    user,
                    filterName,
                },
            },
        };
        this.notifyMe(watcher, subMessage);
    }

    private notifyMeRemoveUser(watcher: ExSocketInterface, user: SpaceUserExtended, filterName: string | undefined) {
        const subMessage: SubMessage = {
            message: {
                $case: "removeSpaceUserMessage",
                removeSpaceUserMessage: {
                    spaceName: this.name,
                    userId: user.id,
                    filterName,
                },
            },
        };
        this.notifyMe(watcher, subMessage);
    }

    public isEmpty() {
        return this.users.size === 0;
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
