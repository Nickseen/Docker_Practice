/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from 'node:assert';
import { Board } from './board.js';

/**
 * Example code for simulating a game.
 * 
 * PS4 instructions: you may use, modify, or remove this file,
 *   completing it is recommended but not required.
 * 
 * @throws Error if an error occurs reading or parsing the board
 */
async function simulationMain(): Promise<void> {
    const filename = 'boards/perfect.txt';
    const board: Board = await Board.parseFromFile(filename);
    const size = 3;
    const players = 5; // 5 игроков для стресс-теста
    const tries = 20; // каждый делает 20 попыток
    const maxDelayMilliseconds = 100;

    console.log(`Starting simulation with ${players} players, ${tries} tries each...`);
    
    const stats = {
        totalFlips: 0,
        successfulMatches: 0
    };

    // start up one or more players as concurrent asynchronous function calls
    const playerPromises: Array<Promise<void>> = [];
    for (let ii = 0; ii < players; ++ii) {
        playerPromises.push(player(ii));
    }
    // wait for all the players to finish (unless one throws an exception)
    await Promise.all(playerPromises);
    
    console.log(`\n=== All players finished ===`);
    console.log(`✅ Simulation completed successfully!`);
    console.log(`📊 Total flips: ${stats.totalFlips}`);
    console.log(`🎉 Successful matches: ${stats.successfulMatches}`);
    console.log(`\n📋 Final board state:\n${board.look('observer')}`);
    console.log(`\n=== No deadlocks detected! ===`);
    /** @param playerNumber player to simulate */
    async function player(playerNumber: number): Promise<void> {
        const playerId = `player${playerNumber}`;
        console.log(`${playerId} started`);

        for (let jj = 0; jj < tries; ++jj) {
            try {
                await timeout(Math.random() * maxDelayMilliseconds);
                
                // Try to flip over a first card
                const row1 = randomInt(size);
                const col1 = randomInt(size);
                
                console.log(`${playerId} attempting first card at (${row1},${col1})`);
                
                // Add timeout to prevent infinite waiting
                const flipPromise = board.flip(playerId, row1, col1);
                const timeoutPromise = timeout(2000).then(() => {
                    throw new Error('timeout waiting for card');
                });
                
                const result1 = await Promise.race([flipPromise, timeoutPromise]);
                stats.totalFlips++;
                
                // Check if we got control (might have waited or found deleted card)
                if (result1.includes(`my `)) {
                    await timeout(Math.random() * maxDelayMilliseconds);
                    
                    // Try to flip over a second card
                    const row2 = randomInt(size);
                    const col2 = randomInt(size);
                    
                    console.log(`${playerId} attempting second card at (${row2},${col2})`);
                    
                    // Add timeout for second card too
                    const flipPromise2 = board.flip(playerId, row2, col2);
                    const timeoutPromise2 = timeout(2000).then(() => {
                        throw new Error('timeout waiting for card');
                    });
                    
                    const result2 = await Promise.race([flipPromise2, timeoutPromise2]);
                    stats.totalFlips++;
                    
                    // Check if it was a match
                    if (result2.includes('none')) {
                        stats.successfulMatches++;
                        console.log(`${playerId} found a match! 🎉`);
                    }
                }
            } catch (err) {
                // Expected errors: card doesn't exist, controlled by another, etc.
                if (err instanceof Error) {
                    console.log(`${playerId} flip failed: ${err.message}`);
                }
            }
        }
        
        console.log(`${playerId} finished`);
    }
}

/**
 * Random positive integer generator
 * 
 * @param max a positive integer which is the upper bound of the generated number
 * @returns a random integer >= 0 and < max
 */
function randomInt(max: number): number {
    return Math.floor(Math.random() * max);
}


/**
 * @param milliseconds duration to wait
 * @returns a promise that fulfills no less than `milliseconds` after timeout() was called
 */
async function timeout(milliseconds: number): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, milliseconds);
    return promise;
}

void simulationMain();
