import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, CommandInteraction, TextChannel, DMChannel, NewsChannel, ThreadChannel, Interaction } from 'discord.js';
import 'dotenv/config';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
});

const activeCalls = new Map<string, string>();
let waitingChannel: string | null = null;

// Type guard to ensure the channel can send messages
function isSendableChannel(channel: any): channel is TextChannel | DMChannel | NewsChannel | ThreadChannel {
    return channel &&
        (channel instanceof TextChannel ||
        channel instanceof DMChannel ||
        channel instanceof NewsChannel ||
        channel instanceof ThreadChannel);
}

const { EmbedBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with pong'),

    new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Greets you'),

    new SlashCommandBuilder()
        .setName('echo')
        .setDescription('Repeats your message')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to echo')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('fortune')
        .setDescription('Get your fortune from Astral')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The question that will determine your fortune')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble and double what you have!'),

    new SlashCommandBuilder()
        .setName('call')
        .setDescription('Call another server and talk'),

    new SlashCommandBuilder()
        .setName('hangup')
        .setDescription('Hang up a call'),
];

// Fortune responses array
const fortuneResponses = [
    "🟢 It is certain","🟢 It is decidedly so","🟢 Without a doubt","🟢 Yes definitely","🟢 You may rely on it",
    "🟢 As I see it, yes","🟢 Most likely","🟢 Outlook good","🟢 Yes","🟢 Signs point to yes",
    "🟡 Reply hazy, try again","🟡 Ask again later","🟡 Better not tell you now","🟡 Cannot predict now","🟡 Concentrate and ask again",
    "🔴 Don't count on it","🔴 My reply is no","🔴 My sources say no","🔴 Outlook not so good","🔴 Very doubtful","🔴 No","🔴 Absolutely not","🔴 Not a chance"
];

const gambleThings = ["🍋","🍓","🍒","🍉","🍇"];

let money: number = 0;
let change: string;

client.once('ready', async () => {
    console.log(`Bot is online! Logged in as ${client.user?.tag}.`);

    console.log('Token loaded:', process.env.DISCORD_TOKEN ? 'Yes' : 'No');
    console.log('Guild ID loaded:', process.env.GUILD_ID ? 'Yes' : 'No');
    console.log('Guild ID2 loaded:', process.env.GUILD_ID2 ? 'Yes' : 'No');
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    try {
        console.log("Started refreshing application (/) commands.");

        const guilds = [process.env.GUILD_ID!, process.env.GUILD_ID2!];

            for (const guildId of guilds) {
            console.log(`Registering commands for guild ${guildId}`);
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(client.user!.id, guildId),
                        { body: commands.map(c => c.toJSON()) }
                    );
                    console.log(`Commands registered for guild ${guildId}`);
                } 
                catch (err) {
                    console.error(`Failed to register commands for guild ${guildId}:`, err);
            }
}
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.log("Error registering commands:", error);
    }
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'ping') {
            await interaction.reply("Pong!🏓");
        }
        else if (commandName === 'hello') {
            await interaction.reply(`Hello, ${interaction.user.username}! 👋`);
        }
        else if (commandName === 'echo') {
            const text = interaction.options.getString('text');
            await interaction.reply(text || '❌ No text provided');
        }
        else if (commandName === 'fortune') {
            const question = interaction.options.getString('question');
            const randomIndex = Math.floor(Math.random() * fortuneResponses.length);
            const response = fortuneResponses[randomIndex];

            await interaction.reply({
                content: `🔮 **${interaction.user.username} asks:** ${question}\n\n**Your fortune says:** ${response}`
            });
        }
        else if (commandName === 'gamble') {
            const thingy = gambleThings[Math.floor(Math.random() * gambleThings.length)];
            const thingy2 = gambleThings[Math.floor(Math.random() * gambleThings.length)];
            const thingy3 = gambleThings[Math.floor(Math.random() * gambleThings.length)];

            if (thingy === thingy2 && thingy2 === thingy3) {
                change = "Jackpot! +10, *3";
                money += 10;
                money *= 3;
            } else if (thingy === thingy2 || thingy2 === thingy3 || thingy === thingy3) {
                change = "Two same! small winnings, +30, *1.2";
                money += 30;
                money *= 1.2;
            } else {
                change = "None are the same, -100, /2";
                money -= 100;
                money /= 2;
            }
            money = parseFloat(money.toFixed(3));

            const gambleResults = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("🎰-CASINO-🎰")
                .setDescription(`${thingy} | ${thingy2} | ${thingy3}\nServer Cash: ${money}\n${change}`);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [gambleResults] });
            } else {
                await interaction.reply({ embeds: [gambleResults] });
            }
        }
        if (commandName === 'call') {
            if (activeCalls.has(interaction.channelId)) {
                await interaction.reply("⚠️ This channel is already in a call.");
                return;
            }

            if (waitingChannel) {
                // Connect to waiting channel
                activeCalls.set(waitingChannel, interaction.channelId);
                activeCalls.set(interaction.channelId, waitingChannel);

                const partner = await client.channels.fetch(waitingChannel);
                if (isSendableChannel(partner)) await partner.send("📞 Connected!");
                await interaction.reply("📞 Connected!");
                waitingChannel = null;
            } else {
                waitingChannel = interaction.channelId;
                await interaction.reply("☎️ Waiting for another channel to connect...");
            }
        }
        else if (commandName === 'hangup') {
            const partnerId = activeCalls.get(interaction.channelId);
            if (partnerId) {
                activeCalls.delete(interaction.channelId);
                activeCalls.delete(partnerId);

                const partner = await client.channels.fetch(partnerId);
                if (isSendableChannel(partner)) await partner.send("❌ Call ended.");
                await interaction.reply("❌ Call ended.");
            } else {
                await interaction.reply("⚠️ This channel is not in a call.");
            }
        }
    } 
    catch (error) {
        console.error('Error handling command:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'Something went wrong!', ephemeral: true });
        }
    }
});

// Handle message relay for calls
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    const partnerId = activeCalls.get(msg.channel.id);
    if (partnerId) {
        const partner = await client.channels.fetch(partnerId);
        if (isSendableChannel(partner)) {
            await partner.send(`[${msg.author.username}]: ${msg.content}`);
        }
    }
});


client.login(process.env.DISCORD_TOKEN);