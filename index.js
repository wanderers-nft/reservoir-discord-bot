const axios = require("axios");
const {
  Client,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  SelectMenuBuilder,
  Events,
  GatewayIntentBits,
} = require("discord.js");
require("dotenv").config();
const redis = require("redis");
const winston = require("winston");

const redisClient = redis.createClient();
const contractAddress = process.env.TRACKED_CONTRACT;
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [new winston.transports.Console()],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

redisClient.connect();

redisClient.on("connect", async () => {
  logger.info("Connected to redis client.");
  if (!(await redisClient.get("floorprice"))) {
    redisClient.set("floorprice", "999999999");
    logger.info("redis floorprice key not found, initializing value");
  }
  if (!(await redisClient.get("floorprice"))) {
    redisClient.set("topbid", "0.00000001");
    logger.info("redis topbid key not found, initializing value");
  }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", async () => {
  logger.info("Discord bot logged in");
  const channel = client.channels.cache.get(process.env.CHANNEL_ID);
  console.log(channel);
  /* const floorPoll = async (resolve, reject) => {
    const {
      data: { events: floorData },
    } = await axios.get(
      `https://api.reservoir.tools/events/collections/floor-ask/v1?collection=${contractAddress}&sortDirection=desc&limit=1`
    );
    const initial = parseFloat(await redisClient.get("floorprice"));
    if (floorData[0].floorAsk.price < initial) {
      await redisClient.set("floorprice", floorData[0].floorAsk.price);
      const value = await redisClient.get("floorprice");
      const {
        data: { tokens: floorToken },
      } = await axios.get(
        `https://api.reservoir.tools/tokens/v5?tokens=${floorData[0].floorAsk.contract}%3A${floorData[0].floorAsk.tokenId}&sortBy=floorAskPrice&limit=20&includeTopBid=false&includeAttributes=true`
      );

      const attributes = floorToken[0].token.attributes.map((attr) => {
        return { name: attr.key, value: attr.value, inline: true };
      });
      const floorEmbed = new EmbedBuilder()
        .setColor(0x8b43e0)
        .setTitle("New Floor Listing!")
        .setAuthor({
          name: `${floorToken[0].token.collection.name}`,
          url: "https://reservoir.tools/",
          iconURL: `${floorToken[0].token.collection.image}`,
        })
        .setDescription(
          `${
            floorToken[0].token.name
          } was just listed for ${value}Ξ by [${floorToken[0].token.owner.substring(
            0,
            6
          )}](https://www.reservoir.market/address/${floorToken[0].token.owner})
          Last Sale: ${floorToken[0].token.lastSell.value}Ξ
          Rarity Rank: ${floorToken[0].token.rarityRank}
          
          `
        )
        .addFields(attributes)
        .setThumbnail(`${floorToken[0].token.image}`)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Purchase")
          .setStyle("Link")
          .setURL(
            `https://www.reservoir.market/${floorData[0].floorAsk.contract}/${floorData[0].floorAsk.tokenId}`
          )
      );
      channel.send({ embeds: [floorEmbed], components: [row] });
    }

    setTimeout(floorPoll, 2500, resolve, reject);
  };

  const offerPoll = async (resolve, reject) => {
    const {
      data: { events: bidData },
    } = await axios.get(
      `https://api.reservoir.tools/events/collections/top-bid/v1?collection=${contractAddress}&sortDirection=desc&limit=1`
    );
    const initial = parseFloat(await redisClient.get("topbid"));
    if (bidData[0].topBid.price > initial) {
      await redisClient.set("topbid", bidData[0].topBid.price);
      const value = await redisClient.get("topbid");
      const {
        data: { collections: bidCollData },
      } = await axios.get(
        `https://api.reservoir.tools/collections/v5?id=${contractAddress}&includeTopBid=false&sortBy=allTimeVolume&limit=1`
      );
      const bidEmbed = new EmbedBuilder()
        .setColor(0x8b43e0)
        .setTitle("New Top Bid!")
        .setAuthor({
          name: `${bidCollData[0].name}`,
          url: "https://reservoir.tools/",
          iconURL: `${bidCollData[0].image}`,
        })
        .setDescription(
          `The top bid on the collection just went up to ${value}Ξ made by [${bidData[0].topBid.maker.substring(
            0,
            6
          )}](https://www.reservoir.market/address/${bidData[0].topBid.maker})`
        )
        .setThumbnail(`${bidCollData[0].image}`)
        .setTimestamp();
      channel.send({ embeds: [bidEmbed] });
    }
    setTimeout(offerPoll, 2500, resolve, reject);
  };

  await floorPoll();
  await offerPoll(); */
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "collection") {
    try {
      const options = interaction.options._hoistedOptions;
      const name =
        options[options.findIndex((obj) => obj.name == "name")].value;
      let limit = 5;
      let contracts = "";

      if (options.findIndex((obj) => obj.name == "limit") != -1) {
        const quantity =
          options[options.findIndex((obj) => obj.name == "limit")].value;
        if (quantity >= 20) {
          limit = 20;
        } else if (quantity < 1) {
          limit = 1;
        } else {
          limit = quantity;
        }
      }

      const {
        data: { collections: searchResults },
      } = await axios.get(
        `https://api.reservoir.tools/search/collections/v1?name=${name}&limit=${limit}`
      );

      searchResults.map((coll) => {
        contracts += "&contract=" + coll.contract;
      });

      const {
        data: { collections: collData },
      } = await axios.get(
        `https://api.reservoir.tools/collections/v5?includeTopBid=true&sortBy=allTimeVolume${contracts}`
      );

      let fieldValue = "";
      searchResults.map((coll) => {
        const currentColl =
          collData[collData.findIndex((obj) => obj.name == coll.name)];
        fieldValue += `**[${
          coll.name
        }](https://www.reservoir.market/collections/${coll.contract})**
      ${
        currentColl.floorAsk.price
          ? "Floor Ask: " + currentColl.floorAsk.price.amount.native
          : "No floor ask found"
      }
      ${
        currentColl.topBid.price
          ? "Top Bid: " + currentColl.topBid.price.amount.native
          : "No bids found"
      }
      `;
        if (currentColl.floorAsk.price && currentColl.topBid.price) {
          fieldValue += `Spread: ${
            currentColl.floorAsk.price.amount.native -
            currentColl.topBid.price.amount.native
          }
        `;
        }
      });

      const testEmbed = new EmbedBuilder()
        .setColor(0x8b43e0)
        .setTitle("Search Results")
        .setAuthor({
          name: "Reservoir Bot",
          url: "https://reservoir.tools/",
          iconURL:
            "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=4096",
        })
        .setDescription(
          searchResults.length != 0
            ? `**The top ${searchResults.length} results for "${name}" are:**
        ${fieldValue}`
            : `**No results found for "${name}"**`
        )
        .setThumbnail(
          "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=4096"
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [testEmbed],
      });
      return;
    } catch (error) {
      console.log(error);
      await interaction.reply(
        "Error searching for collections, try again later"
      );
      return;
    }
  }

  if (interaction.commandName === "stats") {
    try {
      const options = interaction.options._hoistedOptions;
      const name =
        options[options.findIndex((obj) => obj.name == "name")].value;
      let contracts = "";

      const {
        data: { collections: searchResults },
      } = await axios.get(
        `https://api.reservoir.tools/search/collections/v1?name=${name}&limit=5`
      );

      searchResults.map((coll) => {
        contracts += "&contract=" + coll.contract;
      });

      let fieldValue = "";
      let counter = 1;
      const selectOptions = searchResults.map((coll) => {
        fieldValue += `**${counter}. [${coll.name}](https://www.reservoir.market/collections/${coll.contract})**
      `;
        counter++;
        return { label: coll.name, value: coll.contract };
      });

      const testEmbed = new EmbedBuilder()
        .setColor(0x8b43e0)
        .setTitle("Search Results")
        .setAuthor({
          name: "Reservoir Bot",
          url: "https://reservoir.tools/",
          iconURL:
            "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=4096",
        })
        .setDescription(
          searchResults.length != 0
            ? `**The top ${searchResults.length} results for "${name}" are:**
        ${fieldValue}
        Please select the collection to view stats for below`
            : `**No results found for "${name}"**`
        )
        .setThumbnail(
          "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=4096"
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new SelectMenuBuilder()
          .setCustomId("statselect")
          .setPlaceholder("Nothing selected")
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(selectOptions)
      );

      await interaction.reply({
        embeds: [testEmbed],
        components: [row],
      });
      return;
    } catch (error) {
      console.log(error);
      await interaction.reply(
        "No collections found matching your search term, please try again."
      );
      return;
    }
  }

  if (interaction.commandName === "topbid") {
    try {
      const options = interaction.options._hoistedOptions;
      const name =
        options[options.findIndex((obj) => obj.name == "name")].value;
      let contracts = "";

      const {
        data: { collections: searchResults },
      } = await axios.get(
        `https://api.reservoir.tools/search/collections/v1?name=${name}&limit=5`
      );

      searchResults.map((coll) => {
        contracts += "&contract=" + coll.contract;
      });

      let fieldValue = "";
      let counter = 1;
      const selectOptions = searchResults.map((coll) => {
        fieldValue += `**${counter}. [${coll.name}](https://www.reservoir.market/collections/${coll.contract})**
      `;
        counter++;
        return { label: coll.name, value: coll.contract };
      });

      const testEmbed = new EmbedBuilder()
        .setColor(0x8b43e0)
        .setTitle("Search Results")
        .setAuthor({
          name: "Reservoir Bot",
          url: "https://reservoir.tools/",
          iconURL:
            "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=4096",
        })
        .setDescription(
          searchResults.length != 0
            ? `**The top ${searchResults.length} results for "${name}" are:**
        ${fieldValue}
        Please select the collection to view stats for below`
            : `**No results found for "${name}"**`
        )
        .setThumbnail(
          "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=4096"
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new SelectMenuBuilder()
          .setCustomId("bidselect")
          .setPlaceholder("Nothing selected")
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(selectOptions)
      );

      await interaction.reply({
        embeds: [testEmbed],
        components: [row],
      });
      return;
    } catch (error) {
      console.log(error);
      await interaction.reply({
        content:
          "No collections found matching your search term, please try again.",
      });
      return;
    }
  }

  console.log("Unknown Command");
  await interaction.reply({
    content: "Error: Unknown Command",
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isSelectMenu()) return;

  if (interaction.customId === "statselect") {
    try {
      const {
        data: { collections: collStats },
      } = await axios.get(
        `https://api.reservoir.tools/collections/v5?id=${interaction.values[0]}&includeTopBid=false&sortBy=allTimeVolume&limit=1`
      );
      const statEmbed = new EmbedBuilder()
        .setColor(0x8b43e0)
        .setTitle(`${collStats[0].name} Stats`)
        .setAuthor({
          name: "Reservoir Bot",
          url: "https://reservoir.tools/",
          iconURL:
            "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=1024",
        })
        .setDescription(
          `Token Count: ${collStats[0].tokenCount}
        On Sale Count: ${collStats[0].onSaleCount}
        7 day volume: ${collStats[0].volume["7day"]}`
        )
        .setThumbnail(
          "https://cdn.discordapp.com/icons/872790973309153280/0dc1b70867aeeb2ee32563f575c191c6.webp?size=1024"
        )
        .setTimestamp();

      await interaction.update({
        embeds: [statEmbed],
      });
      return;
    } catch (error) {
      console.log(error);
      await interaction.update({
        content: "Error pulling collection stats, try again later",
        embeds: [],
        components: [],
      });
      return;
    }
  }

  if (interaction.customId === "bidselect") {
    try {
      const {
        data: { collections: bidCollData },
      } = await axios.get(
        `https://api.reservoir.tools/collections/v5?id=${interaction.values[0]}&includeTopBid=true&sortBy=allTimeVolume&limit=1`
      );

      if (bidCollData[0].topBid.price != null) {
        if (bidCollData[0].topBid.price.netAmount.native != null) {
          const bidEmbed = new EmbedBuilder()
            .setColor(0x8b43e0)
            .setTitle(`Collection Top Bid`)
            .setAuthor({
              name: bidCollData[0].name,
              url: "https://reservoir.tools/",
              iconURL: bidCollData[0].image,
            })
            .setDescription(
              `The top bid on the collection is ${
                bidCollData[0].topBid.price.netAmount.native
              }Ξ made by [${bidCollData[0].topBid.maker.substring(
                0,
                6
              )}](https://www.reservoir.market/address/${
                bidCollData[0].topBid.maker
              })`
            )
            .setThumbnail(bidCollData[0].image)
            .setTimestamp();

          await interaction.update({
            embeds: [bidEmbed],
          });
          return;
        } else if (bidCollData[0].topBid.price.amount.native != null) {
          const bidEmbed = new EmbedBuilder()
            .setColor(0x8b43e0)
            .setTitle(`Collection Top Bid`)
            .setAuthor({
              name: `${bidCollData[0].name}`,
              url: "https://reservoir.tools/",
              iconURL: `${bidCollData[0].image}`,
            })
            .setDescription(
              `The top bid on the collection is ${
                bidCollData[0].topBid.price.amount.native
              }Ξ made by [${bidCollData[0].topBid.maker.substring(
                0,
                6
              )}](https://www.reservoir.market/address/${
                bidCollData[0].topBid.maker
              })`
            )
            .setThumbnail(`${bidCollData[0].image}`)
            .setTimestamp();

          await interaction.update({
            embeds: [bidEmbed],
          });
          return;
        }
      } else {
        const bidEmbed = new EmbedBuilder()
          .setColor(0x8b43e0)
          .setTitle(`Collection Top Bid`)
          .setAuthor({
            name: `${bidCollData[0].name}`,
            url: "https://reservoir.tools/",
            iconURL: `${bidCollData[0].image}`,
          })
          .setDescription(`No bids found for ${bidCollData[0].name}`)
          .setThumbnail(`${bidCollData[0].image}`)
          .setTimestamp();

        await interaction.update({
          embeds: [bidEmbed],
        });
        return;
      }
    } catch (error) {
      console.log(error.requestBody.json.data);
      await interaction.update({
        content: "Error pulling collection stats, try again later",
        embeds: [],
        components: [],
      });
      return;
    }
  }

  console.log("Unknown Selection");
  await interaction.reply({
    content: "Error: Unknown Selection",
  });
});

client.login(process.env.TOKEN);
