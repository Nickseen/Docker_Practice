/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { Card, CardPosition} from './types.js';

/**
 * Mutable game board for Memory Scramble multiplayer game.
 * 
 * Board represents a rectangular grid of cards that can be flipped by multiple players.
 * Players flip cards to find matching pairs. The board is safe for concurrent access
 * by multiple players.
 */
export class Board {

    private readonly width: number;
    private readonly height: number;
    private readonly cards: Card[][]; // двумерный массив карт
    private readonly playerCards: Map<string, CardPosition[]>; // карты под контролем игроков
    private readonly watchers: Set<() => void>; // кто ждёт изменений (для watch)


    // Abstraction function:
    //   AF(width, height, cards, playerCards, watchers) = 
    //     Игровая доска Memory Scramble размером width × height клеток,
    //     где cards[row][col] представляет карту в позиции (row, col).
    //     playerCards отображает каждого игрока на список позиций карт,
    //     которые этот игрок в данный момент контролирует.
    //     watchers - набор функций, ожидающих уведомления об изменении доски.
        
    // Representation invariant:
    //   - width > 0 и height > 0
    //   - cards - прямоугольный массив размером height × width
    //   - cards[row][col].state ∈ {'down', 'up', 'none'} для всех row, col
    //   - каждый игрок контролирует 0, 1 или 2 карты
    //   - если карта контролируется игроком, то она существует (state ≠ 'none')
    //   - никакая карта не контролируется более чем одним игроком
    //   - все позиции в playerCards указывают на существующие клетки доски
    
    // Safety from rep exposure:
    //   - все поля объявлены как private и/или readonly
    //   - конструктор приватный, создание только через parseFromFile
    //   - метод look() возвращает строку (immutable), а не ссылку на cards
    //   - метод flip() не возвращает ссылки на внутренние структуры
    //   - внешний код не может получить доступ к cards, playerCards, watchers

    // TODO constructor
    private constructor(width: number, height: number, cards: Card[][]) {
    this.width = width;
    this.height = height;
    this.cards = cards;
    this.playerCards = new Map();
    this.watchers = new Set();
    this.checkRep();
    }

    // TODO checkRep
    private checkRep(): void {
        assert(this.width > 0 && this.height > 0);
        assert(this.cards.length === this.height);
        assert(this.cards.every(row => row.length === this.width));
        // проверка, что каждый игрок контролирует максимум 2 карты
        for (const positions of this.playerCards.values()) {
            assert(positions.length <= 2);
        }
    }

    // TODO other methods

    /**
     * Returns the current state of the board from the perspective of a player.
     * 
     * @param playerId ID of the player viewing the board
     * @returns string representation of the board
     */
    public look(playerId: string): string {
        this.checkRep();
        
        let result = `${this.width}x${this.height}\n`;
        
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const card = this.cards[row]![col];
                assert(card !== undefined);

                if (card.state === 'none') {
                    // Карта удалена
                    result += 'none\n';
                } else if (card.controlledBy === playerId) {
                    // Карта под контролем этого игрока
                    result += `my ${card.label}\n`;
                } else if (card.state === 'up') {
                    // Карта открыта (видна всем)
                    result += `up ${card.label}\n`;
                } else {
                    // Карта закрыта
                    result += 'down\n';
                }
            }
        }
        
        this.checkRep();
        return result.trim();
    }

    /**
     * Get the positions of cards controlled by a player.
     * 
     * @param playerId ID of the player
     * @returns array of card positions controlled by this player
     */
    private getPlayerCards(playerId: string): CardPosition[] {
        return this.playerCards.get(playerId) || [];
    }

    /**
     * Flip a card on the board.
     * 
     * @param playerId ID of the player flipping the card
     * @param row row of the card
     * @param column column of the card
     * @returns updated board state from player's perspective
     * @throws Error if flip is invalid
     */
    public flip(playerId: string, row: number, column: number): string {
        this.checkRep();
        
        // Проверка границ
        if (row < 0 || row >= this.height || column < 0 || column >= this.width) {
            throw new Error('card position out of bounds');
        }

        const card = this.cards[row]![column];
        assert(card !== undefined);

        // Проверка: карта существует
        if (card.state === 'none') {
            throw new Error('card does not exist');
        }
        
        // Проверка: карта не занята другим игроком
        if (card.controlledBy !== null && card.controlledBy !== playerId) {
            throw new Error('card is controlled by another player');
        }
        
        const myCards = this.getPlayerCards(playerId);
        
        // Проверка: не контролирую больше 2 карт
        if (myCards.length >= 2) {
            throw new Error('you already control 2 cards');
        }
        
        // Логика флипа
        if (myCards.length === 0) {
            // Первая карта - беру под контроль
            card.controlledBy = playerId;
            card.state = 'up';
            this.playerCards.set(playerId, [{ row, column }]);
            
        } else if (myCards.length === 1) {
            // Вторая карта - проверяю совпадение
            const firstPos = myCards[0]!;
            const firstCard = this.cards[firstPos.row]![firstPos.column];
            assert(firstCard !== undefined);
            
            card.controlledBy = playerId;
            card.state = 'up';
            
            // Проверка совпадения меток
            if (firstCard.label === card.label) {
                // Совпадение - удаляем обе карты
                firstCard.state = 'none';
                card.state = 'none';
            } else {
                // Не совпадают - закрываем обе
                firstCard.state = 'down';
                card.state = 'down';
            }
            
            // Освобождаем контроль
            firstCard.controlledBy = null;
            card.controlledBy = null;
            this.playerCards.delete(playerId);
        }
        
        this.notifyWatchers(); // TODO for watch()
        this.checkRep();
        return this.look(playerId);
    }
    
    /**
     * Notify all watching players that the board has changed.
     */
    private notifyWatchers(): void {
        for (const resolve of this.watchers) {
            resolve();
        }
        this.watchers.clear();
    }

    /**
     * Wait for the board to change, then return the updated state.
     * 
     * @param playerId ID of the player watching
     * @returns the new state of the board after a change occurs
     */
    public async watch(playerId: string): Promise<string> {
        this.checkRep();
        
        // Создаём Promise, который выполнится при следующем изменении
        const { promise, resolve } = Promise.withResolvers<void>();
        
        // Сохраняем resolve в список ожидающих
        this.watchers.add(resolve);
        
        // Ждём изменения
        await promise;
        
        // Возвращаем обновлённое состояние
        this.checkRep();
        return this.look(playerId);
    }

    /**
     * Replace all cards on the board by applying a function to each card label.
     * Maintains pairwise consistency during replacement.
     * 
     * @param playerId ID of the player applying the map
     * @param f function to apply to each card label
     * @returns the state of the board after replacement
     */
    public async map(playerId: string, f: (card: string) => Promise<string>): Promise<string> {
        this.checkRep();
        
        // Собираем все уникальные значения карт
        const uniqueLabels = new Set<string>();
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const card = this.cards[row]![col];
                assert(card !== undefined);
                if (card.state !== 'none') {
                    uniqueLabels.add(card.label);
                }
            }
        }
        
        // Вычисляем новые значения для каждой уникальной метки
        const mapping = new Map<string, string>();
        for (const label of uniqueLabels) {
            mapping.set(label, await f(label));
        }
        
        // Применяем замену АТОМАРНО (все сразу)
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const card = this.cards[row]![col];
                assert(card !== undefined);
                if (card.state !== 'none') {
                    const newLabel = mapping.get(card.label);
                    if (newLabel !== undefined) {
                        card.label = newLabel;
                    }
                }
            }
        }
        
        this.notifyWatchers();
        this.checkRep();
        return this.look(playerId);
    }

    /**
     * Make a new board by parsing a file.
     * 
     * PS4 instructions: the specification of this method may not be changed.
     * 
     * @param filename path to game board file
     * @returns a new board with the size and cards from the file
     * @throws Error if the file cannot be read or is not a valid game board
     */
    public static async parseFromFile(filename: string): Promise<Board> {
        const content = await fs.promises.readFile(filename, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length === 0 || !lines[0]) {
            throw new Error('empty board file');
        }
        
        // Парсим размер
        const [widthStr, heightStr] = lines[0].split('x');
        if (!widthStr || !heightStr) {
            throw new Error('invalid board format: expected WxH');
        }
        const width = parseInt(widthStr);
        const height = parseInt(heightStr);
        
        // Читаем карты
        const cardLabels = lines.slice(1); // все строки кроме первой
        
        // Создаём двумерный массив
        const cards: Card[][] = [];
        let index = 0;
        for (let row = 0; row < height; row++) {
            const cardRow: Card[] = [];
            for (let col = 0; col < width; col++) {
                const label = cardLabels[index];
                if (!label) {
                    throw new Error('not enough card labels in board file');
                }
                cardRow.push({
                    label: label.trim(),
                    state: 'down',
                    controlledBy: null
                });
                index++;
            }
            cards.push(cardRow);
        }
        
        return new Board(width, height, cards);
    }
}
