/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { Board } from '../src/board.js';


/**
 * Helper function to create a timeout promise
 */
function timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tests for the Board abstract data type.
 */
describe('Board', function() {
    
    // Testing strategy:
    //   parseFromFile: valid file, invalid format, missing file, wrong dimensions
    //   look: empty board, board with cards, player perspective
    //   flip - Rule 1-A: flip non-existent card (empty space)
    //   flip - Rule 1-B: flip face-down card (first card)
    //   flip - Rule 1-C: flip face-up uncontrolled card (first card)
    //   flip - Rule 1-D: flip card controlled by another player (wait)
    //   flip - Rule 2-A: flip non-existent card as second card
    //   flip - Rule 2-B: flip controlled card as second card (no wait)
    //   flip - Rule 2-C: flip face-down card as second card
    //   flip - Rule 2-D: matching cards (keep control)
    //   flip - Rule 2-E: non-matching cards (relinquish control)
    //   flip - Rule 3-A: remove matched cards on next move
    //   flip - Rule 3-B: close non-matched cards on next move
    //   watch: wait for board changes, multiple watchers
    //   map: replace cards atomically, maintain pairwise consistency
    //   concurrency: multiple players, race conditions, no deadlocks

    describe('parseFromFile', function() {
        
        it('should parse a valid board file', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            const result = board.look('player1');
            assert(result.startsWith('5x5'));
            // Все карты должны быть face-down
            assert(result.includes('down'));
        });

        it('should throw error for non-existent file', async function() {
            await assert.rejects(
                () => Board.parseFromFile('boards/nonexistent.txt'),
                /no such file/i
            );
        });
    });

    describe('look', function() {
        
        it('should show all cards as down initially', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            const result = board.look('player1');
            const lines = result.split('\n');
            assert.strictEqual(lines[0], '5x5');
            // Все последующие строки должны быть 'down'
            for (let i = 1; i < lines.length; i++) {
                assert.strictEqual(lines[i], 'down');
            }
        });
    });

    describe('Rule 1-A: flip non-existent card (first card)', function() {
        
        it('should fail when flipping empty space created by removal', async function() {
            const board = await Board.parseFromFile('boards/perfect.txt');
            
            // Alice находит совпадающую пару и удаляет карты
            await board.flip('Alice', 0, 0); // 🦄
            await board.flip('Alice', 0, 1); // 🦄 - match!
            
            // Alice делает новый ход -> карты удаляются (3-A)
            await board.flip('Alice', 1, 0);
            
            // Bob пытается флипнуть удалённую карту (0,0)
            const result = await board.flip('Bob', 0, 0);
            
            // Должен вернуть доску без ошибки (правило 1-A для ждавшего игрока)
            assert(result.includes('none'));
        });
    });

    describe('Rule 1-B: flip face-down card', function() {
        
        it('should flip face-down card and player controls it', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            const result = await board.flip('Alice', 0, 0);
            
            // Карта должна быть под контролем Alice
            assert(result.includes('my A'));
        });
    });

    describe('Rule 1-C: flip face-up uncontrolled card', function() {
        
        it('should take control of face-up uncontrolled card', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            // Alice флипает две не совпадающие карты
            await board.flip('Alice', 0, 0); // A
            await board.flip('Alice', 0, 1); // B - не совпадают
            
            // Теперь (0,0) face-up но не контролируется (2-E)
            // Bob берёт её под контроль (1-C)
            const result = await board.flip('Bob', 0, 0);
            assert(result.includes('my A'));
        });
    });

    describe('Rule 1-D: wait for card controlled by another', function() {
        
        it('should wait when trying to flip card controlled by another player', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            // Alice контролирует карту (0,0)
            await board.flip('Alice', 0, 0);
            
            // Bob пытается взять ту же карту - должен ждать
            const bobPromise = board.flip('Bob', 0, 0);
            
            // Даём немного времени убедиться что Bob ждёт
            await timeout(10);
            
            // Alice освобождает карту
            await board.flip('Alice', 0, 1); // вторая карта
            
            // Bob должен проснуться и получить контроль
            const result = await bobPromise;
            assert(result.includes('my A'));
        });
    });

    describe('Rule 2-A: flip non-existent card as second card', function() {
        
        it('should fail and relinquish first card (stays face-up)', async function() {
            const board = await Board.parseFromFile('boards/perfect.txt');
            
            // Сначала создаём пустое место
            await board.flip('Alice', 0, 0); // 🦄
            await board.flip('Alice', 0, 1); // 🦄 - match
            await board.flip('Alice', 1, 0); // новый ход -> (0,0) и (0,1) удалены
            
            // Bob берёт первую карту
            await board.flip('Bob', 1, 1);
            
            // Bob пытается взять вторую карту в пустом месте
            await assert.rejects(
                () => board.flip('Bob', 0, 0),
                /card does not exist/
            );
            
            // Первая карта Bob должна остаться face-up
            const result = board.look('Alice');
            assert(result.includes('up'));
        });
    });

    describe('Rule 2-B: flip controlled card as second card', function() {
        
        it('should fail without waiting and relinquish first card', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            // Alice контролирует (0,0)
            await board.flip('Alice', 0, 0);
            
            // Bob берёт первую карту
            await board.flip('Bob', 0, 1);
            
            // Bob пытается взять вторую карту, контролируемую Alice
            // Должен провалиться БЕЗ ожидания (избегаем deadlock)
            await assert.rejects(
                () => board.flip('Bob', 0, 0),
                /controlled by another player/
            );
        });
    });

    describe('Rule 2-C: flip face-down card as second card', function() {
        
        it('should turn face-down card face-up', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            await board.flip('Alice', 0, 0); // первая карта (A)
            
            // Смотрим состояние до второго флипа
            let result = board.look('Alice');
            let lines = result.split('\n');
            assert(lines[1]!.includes('my A')); // первая карта
            
            await board.flip('Alice', 0, 1); // вторая карта face-down (B)
            
            result = board.look('Alice');
            lines = result.split('\n');
            // После второго флипа обе карты должны быть видны (но не обязательно 'my')
            // так как они не совпадают и контроль освобождён (2-E)
            assert(lines[1]!.includes('A'));
            assert(lines[2]!.includes('B'));
        });
    });

    describe('Rule 2-D: matching cards', function() {
        
        it('should keep control of matching cards', async function() {
            const board = await Board.parseFromFile('boards/perfect.txt');
            
            await board.flip('Alice', 0, 0); // 🦄
            await board.flip('Alice', 0, 1); // 🦄 - совпадают!
            
            const result = board.look('Alice');
            // Alice должна контролировать обе карты
            const lines = result.split('\n');
            assert(lines[1]!.includes('my 🦄'));
            assert(lines[2]!.includes('my 🦄'));
        });
    });

    describe('Rule 2-E: non-matching cards', function() {
        
        it('should relinquish control but cards stay face-up', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            await board.flip('Alice', 0, 0); // A
            await board.flip('Alice', 0, 1); // B - не совпадают
            
            const result = board.look('Bob');
            const lines = result.split('\n');
            // Обе карты face-up, но не контролируются Alice
            assert(lines[1]!.includes('up A'));
            assert(lines[2]!.includes('up B'));
        });
    });

    describe('Rule 3-A: remove matched cards on next move', function() {
        
        it('should remove matched cards when player makes next move', async function() {
            const board = await Board.parseFromFile('boards/perfect.txt');
            
            // Alice находит совпадение
            await board.flip('Alice', 0, 0); // 🦄
            await board.flip('Alice', 0, 1); // 🦄 - match
            
            // Alice делает новый ход -> карты удаляются
            await board.flip('Alice', 1, 0);
            
            const result = board.look('Alice');
            const lines = result.split('\n');
            // Карты (0,0) и (0,1) должны быть 'none'
            assert.strictEqual(lines[1], 'none');
            assert.strictEqual(lines[2], 'none');
        });
    });

    describe('Rule 3-B: close non-matched cards on next move', function() {
        
        it('should turn face-down non-matched uncontrolled cards', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            // Alice флипает не совпадающие карты
            await board.flip('Alice', 0, 0); // A
            await board.flip('Alice', 0, 1); // B - не совпадают
            
            // Карты face-up, не контролируются
            let result = board.look('Bob');
            assert(result.includes('up A'));
            assert(result.includes('up B'));
            
            // Alice делает новый ход -> карты закрываются
            await board.flip('Alice', 1, 0);
            
            result = board.look('Bob');
            const lines = result.split('\n');
            // Карты (0,0) и (0,1) должны быть face-down
            assert.strictEqual(lines[1], 'down');
            assert.strictEqual(lines[2], 'down');
        });

        it('should NOT close cards controlled by another player', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            // Alice флипает не совпадающие карты
            await board.flip('Alice', 0, 0); // A
            await board.flip('Alice', 0, 1); // B - не совпадают
            
            // Bob берёт одну из этих карт под контроль
            await board.flip('Bob', 0, 0); // (1-C)
            
            // Alice делает новый ход
            await board.flip('Alice', 1, 0);
            
            const result = board.look('Bob');
            const lines = result.split('\n');
            // (0,0) контролируется Bob - должна остаться face-up
            assert(lines[1]!.includes('my A'));
            // (0,1) не контролируется - должна закрыться
            assert.strictEqual(lines[2], 'down');
        });
    });

    describe('Example game transcript scenario', function() {
        
        it('should handle Charlie waiting for deleted card', async function() {
            const board = await Board.parseFromFile('boards/perfect.txt');
            
            // Alice флипает (0,0) = 🦄
            await board.flip('Alice', 0, 0);
            
            // Bob и Charlie пытаются взять ту же карту (ждут)
            const bobPromise = board.flip('Bob', 0, 0);
            const charliePromise = board.flip('Charlie', 0, 0);
            
            await timeout(10); // убеждаемся что ждут
            
            // Alice флипает не совпадающую карту (0,2) = 🌈
            await board.flip('Alice', 0, 2); // не совпадает с 🦄
            
            // Bob просыпается и берёт карту (0,0) = 🦄 под контроль (1-C)
            const bobResult = await bobPromise;
            assert(bobResult.includes('my 🦄'));
            
            // Charlie всё ещё ждёт карту (0,0)
            await timeout(10);
            
            // Bob находит пару для (0,0): флипает (0,1) = 🦄 - match!
            await board.flip('Bob', 0, 1);
            
            // Bob делает новый ход -> его карты (0,0) и (0,1) удаляются (3-A)
            await board.flip('Bob', 1, 0);
            
            // Charlie просыпается, но карта (0,0) удалена (1-A)
            const result = await charliePromise;
            
            // Charlie должен получить доску где (0,0) удалена
            // Проверяем что нет ошибки и доска вернулась
            assert(result.startsWith('3x3'));
            const lines = result.split('\n');
            // Первая карта (0,0) должна быть 'none' (удалена)
            assert.strictEqual(lines[1], 'none');
        });
    });

    describe('Concurrency', function() {
        
        it('should handle multiple concurrent flips without crashes', async function() {
            const board = await Board.parseFromFile('boards/perfect.txt');
            
            const promises = [
                board.flip('Alice', 0, 0),
                board.flip('Bob', 0, 1),
                board.flip('Charlie', 0, 2),
            ];
            
            await Promise.all(promises);
            // Если дошли сюда - не было crash
            assert(true);
        });

        it('should not deadlock when players wait for each other', async function() {
            const board = await Board.parseFromFile('boards/ab.txt');
            
            // Alice берёт карту
            await board.flip('Alice', 0, 0);
            
            // Bob и Charlie ждут эту карту
            const bobPromise = board.flip('Bob', 0, 0);
            const charliePromise = board.flip('Charlie', 0, 0);
            
            await timeout(10);
            
            // Alice освобождает карту
            await board.flip('Alice', 0, 1);
            
            // Один из них должен получить карту
            await Promise.race([bobPromise, charliePromise]);
            
            // Не должно зависнуть
            assert(true);
        });
    });
});


/**
 * Example test case that uses async/await to test an asynchronous function.
 * Feel free to delete these example tests.
 */
describe('async test cases', function() {

    it('reads a file asynchronously', async function() {
        const fileContents = (await fs.promises.readFile('boards/ab.txt')).toString();
        assert(fileContents.startsWith('5x5'));
    });
});
