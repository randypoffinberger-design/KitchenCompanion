(() => {
  'use strict';

  const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  class KitchenCompanionEngine {
    static version = '0.18.1';
    constructor({ schemaVersion = 1, personalModuleId = 'my-recipes' } = {}) {
      this.schemaVersion = schemaVersion;
      this.personalModuleId = personalModuleId;
    }

    validateModule(module) {
      const errors = [];
      const warnings = [];
      if (!module || typeof module !== 'object' || Array.isArray(module)) throw new Error('Module must be a JSON object.');
      for (const field of ['schemaVersion', 'moduleId', 'name', 'version', 'recipes']) {
        if (module[field] === undefined || module[field] === null || module[field] === '') errors.push(`Missing required field: ${field}`);
      }
      if (module.schemaVersion !== this.schemaVersion) errors.push(`Unsupported schema version: ${module.schemaVersion}. Expected ${this.schemaVersion}.`);
      if (typeof module.moduleId !== 'string' || !ID_PATTERN.test(module.moduleId || '')) errors.push('moduleId must use lowercase letters, numbers, and hyphens only.');
      if (!Array.isArray(module.recipes)) errors.push('recipes must be an array.');
      if (errors.length) throw new Error(errors.join('\n'));

      const ids = new Map();
      module.recipes.forEach((recipe, index) => {
        const label = `Recipe ${index + 1}${recipe?.name ? ` (${recipe.name})` : ''}`;
        if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) { errors.push(`${label} must be an object.`); return; }
        if (typeof recipe.id !== 'string' || !recipe.id.trim()) errors.push(`${label} needs an id.`);
        else if (!ID_PATTERN.test(recipe.id)) errors.push(`${label} has invalid id “${recipe.id}”.`);
        if (typeof recipe.name !== 'string' || !recipe.name.trim()) errors.push(`${label} needs a name.`);
        if (recipe.crossLinkAliases !== undefined && (!Array.isArray(recipe.crossLinkAliases) || recipe.crossLinkAliases.some(alias => typeof alias !== 'string' || !alias.trim()))) errors.push(`${label}: crossLinkAliases must be an array of non-empty strings.`);
        if (recipe.id) {
          if (ids.has(recipe.id)) errors.push(`Duplicate recipe id “${recipe.id}” at recipes ${ids.get(recipe.id) + 1} and ${index + 1}.`);
          else ids.set(recipe.id, index);
        }
        if (!Array.isArray(recipe.ingredientGroups)) errors.push(`${label}: ingredientGroups must be an array.`);
        else recipe.ingredientGroups.forEach((group, groupIndex) => {
          if (!group || typeof group !== 'object' || !Array.isArray(group.ingredients)) errors.push(`${label}: ingredient group ${groupIndex + 1} must contain an ingredients array.`);
          else group.ingredients.forEach((ingredient, ingredientIndex) => {
            if (!ingredient || typeof ingredient !== 'object' || typeof ingredient.item !== 'string' || !ingredient.item.trim()) errors.push(`${label}: ingredient ${groupIndex + 1}.${ingredientIndex + 1} needs an item.`);
            if (ingredient?.quantity !== null && ingredient?.quantity !== undefined && typeof ingredient.quantity !== 'number') errors.push(`${label}: ingredient ${groupIndex + 1}.${ingredientIndex + 1} quantity must be numeric or null.`);
          });
        });
        if (!Array.isArray(recipe.instructions)) errors.push(`${label}: instructions must be an array.`);
        else if (!recipe.instructions.length) warnings.push(`${label} has no instructions.`);
      });
      if (errors.length) throw new Error(`${errors.length} validation problem${errors.length === 1 ? '' : 's'}:\n\n${errors.join('\n\n')}`);
      return { warnings };
    }

    normalizeModule(module) {
      this.validateModule(module);
      return {
        ...module,
        enabled: module.enabled !== false,
        recipes: module.recipes.map(recipe => ({ ...recipe }))
      };
    }

    ensurePersonalModule(modules) {
      let personal = modules.find(module => module.moduleId === this.personalModuleId);
      if (!personal) {
        personal = { schemaVersion: this.schemaVersion, moduleId: this.personalModuleId, name: 'My Recipes', publisher: 'You', version: '1.0.0', description: 'Recipes created or customized in Kitchen Companion.', license: 'Private', enabled: true, recipes: [] };
        modules.push(personal);
      }
      return personal;
    }

    getRecipes(modules, { enabledOnly = true, includeOverridden = false } = {}) {
      const all = modules
        .filter(module => !enabledOnly || module.enabled !== false)
        .flatMap(module => module.recipes.map(recipe => ({ ...recipe, moduleId: module.moduleId, moduleName: module.name, publisher: module.publisher, key: `${module.moduleId}:${recipe.id}` })));
      if (includeOverridden) return all;
      const overridden = new Set(all.filter(recipe => recipe.moduleId === this.personalModuleId && recipe.copiedFrom).map(recipe => recipe.copiedFrom));
      return all.filter(recipe => !overridden.has(recipe.key));
    }

    searchText(recipe) {
      const ingredients = (recipe.ingredientGroups || []).flatMap(group => group.ingredients || []).map(item => item.item).join(' ');
      return [recipe.name, recipe.category, recipe.description, ...(recipe.tags || []), ingredients, recipe.moduleName, recipe.publisher].filter(Boolean).join(' ').toLowerCase();
    }

    filterRecipes(recipes, { query = '', moduleId = 'all', category = 'all', favorites = null } = {}) {
      const normalizedQuery = query.trim().toLowerCase();
      return recipes.filter(recipe => {
        if (moduleId !== 'all' && recipe.moduleId !== moduleId) return false;
        if (category !== 'all' && (recipe.category || 'Uncategorized') !== category) return false;
        if (favorites && !favorites.includes(recipe.key)) return false;
        return !normalizedQuery || this.searchText(recipe).includes(normalizedQuery);
      });
    }

    normalizeCrossLinkText(value) {
      return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[’']/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    crossLinkAliases(recipe) {
      const aliases = [recipe.name, ...(Array.isArray(recipe.crossLinkAliases) ? recipe.crossLinkAliases : [])];
      const genericLead = /^(?:the|a|an|classic|easy|simple|quick|homemade|traditional|creamy|best|ultimate|favorite|family|old fashioned)\s+/;
      const results = new Set();
      aliases.forEach(alias => {
        let normalized = this.normalizeCrossLinkText(alias).replace(/\s+recipe$/, '').trim();
        if (!normalized) return;
        results.add(normalized);
        let shortened = normalized;
        while (genericLead.test(shortened)) shortened = shortened.replace(genericLead, '').trim();
        if (shortened && shortened !== normalized) results.add(shortened);
      });
      return [...results].filter(alias => alias.length >= 4);
    }

    crossLinkPhraseMatch(text, alias) {
      const haystack = ` ${this.normalizeCrossLinkText(text)} `;
      const needle = ` ${this.normalizeCrossLinkText(alias)} `;
      return needle.trim().length >= 4 && haystack.includes(needle);
    }

    buildCrossLinks(recipes) {
      const targets = (recipes || []).filter(recipe => recipe?.key && recipe?.name).map(recipe => ({
        recipe,
        aliases:this.crossLinkAliases(recipe)
      }));
      const outgoingByRecipe = new Map();
      const incomingByRecipe = new Map();
      const pairingCue = /\b(?:serve|served|pair|paired|pairs|alongside|accompanied)\b/i;

      const matchingTargets = (source, text) => targets
        .filter(target => target.recipe.key !== source.key)
        .map(target => {
          const matches = target.aliases.filter(alias => this.crossLinkPhraseMatch(text, alias));
          if (!matches.length) return null;
          const normalizedText = this.normalizeCrossLinkText(text);
          const longestAlias = matches.sort((a, b) => b.length - a.length)[0];
          const exact = normalizedText === longestAlias;
          return { key:target.recipe.key, name:target.recipe.name, moduleName:target.recipe.moduleName, score:(exact ? 1000 : 500) + longestAlias.length };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

      targets.forEach(({ recipe }) => {
        const links = [];
        (recipe.ingredientGroups || []).forEach((group, groupIndex) => {
          (group.ingredients || []).forEach((ingredient, ingredientIndex) => {
            const matches = matchingTargets(recipe, ingredient.item);
            if (matches.length) links.push({
              id:`ingredient-${groupIndex}-${ingredientIndex}`,
              type:'ingredient',
              context:ingredient.item,
              groupIndex,
              ingredientIndex,
              targets:matches
            });
          });
        });

        const pairingTexts = [recipe.description, ...(recipe.instructions || [])]
          .map(text => String(text || '').trim())
          .filter(text => text && pairingCue.test(text));
        pairingTexts.forEach((text, index) => {
          const matches = matchingTargets(recipe, text);
          if (matches.length) links.push({
            id:`pairing-${index}`,
            type:'pairing',
            context:text,
            targets:matches
          });
        });

        outgoingByRecipe.set(recipe.key, links);
        links.forEach(link => link.targets.forEach(target => {
          const incoming = incomingByRecipe.get(target.key) || [];
          if (!incoming.some(item => item.sourceKey === recipe.key)) {
            incoming.push({
              sourceKey:recipe.key,
              sourceName:recipe.name,
              sourceModuleName:recipe.moduleName,
              type:link.type
            });
          }
          incomingByRecipe.set(target.key, incoming);
        }));
      });

      return { outgoingByRecipe, incomingByRecipe };
    }

    installModule(modules, incoming) {
      const module = this.normalizeModule(incoming);
      const index = modules.findIndex(item => item.moduleId === module.moduleId);
      if (index >= 0) modules[index] = module;
      else modules.push(module);
      return { module, replaced: index >= 0 };
    }

    slugify(text) {
      return String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';
    }

    uniqueRecipeId(base, recipes) {
      let id = base; let number = 2;
      while (recipes.some(recipe => recipe.id === id)) id = `${base}-${number++}`;
      return id;
    }

    parseRecipeText(rawText) {
      const normalizeFractions = value => String(value || '')
        .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, '$1/$2')
        .replace(/\bI\s*\/\s*2\b/gi, '1/2')
        .replace(/\bI\s*\/\s*4\b/gi, '1/4')
        .replace(/(\d)\s+([¼½¾⅓⅔⅛⅜⅝⅞])/g, '$1 $2');
      const embeddedClutter = /\s+(?=(?:how to reset your cortisol belly|eat these foods every day|live connected[.]?\s+live invested|discover a resident-owned community|nexdoo\b|sponsored by\b|learn more\b|\$\d{2,4}\s*prime\b|\d{1,2}:\d{2}\s*(?:am|pm)?\b))/i;
      const stripEmbeddedClutter = value => {
        const line = String(value || '').trim();
        const marker = line.search(embeddedClutter);
        return (marker >= 0 ? line.slice(0, marker) : line)
          .replace(/\s+(?:drveganblog[.]com|amazon|xfinity)\s*$/i, '')
          .replace(/\s+(?:®|©|\[(?:J|I|1)?\]?|[¥{}]+)\s*$/i, '')
          .replace(/\s+(?:I\s*=|Co)\s*$/i, '')
          .replace(/\s+\d{1,2}:\d{2}[\s\S]*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      };
      const splitRepeatedTitleLead = value => {
        const line = stripEmbeddedClutter(value);
        const thisMatch = line.match(/\bThis\b/i);
        if (!thisMatch || thisMatch.index < 4) return [line];
        const before = line.slice(0, thisMatch.index).trim();
        const after = line.slice(thisMatch.index).trim();
        const beforeWords = before.match(/[A-Za-z][A-Za-z'-]*/g) || [];
        const afterWords = after.match(/[A-Za-z][A-Za-z'-]*/g) || [];
        if (beforeWords.length < 2 || afterWords.length < 3) return [line];
        const afterTitleWords = afterWords.slice(1);
        let length = Math.min(8, beforeWords.length, afterTitleWords.length);
        while (length >= 2) {
          const left = beforeWords.slice(-length).map(word => word.toLowerCase());
          const right = afterTitleWords.slice(0, length).map(word => word.toLowerCase());
          if (left.every((word, index) => word === right[index])) {
            return [beforeWords.slice(-length).join(' '), after];
          }
          length--;
        }
        return [line];
      };
      const text = normalizeFractions(rawText)
        .replace(/(^|\s)%\s+(?=(?:cup|cups|tbsp|tablespoons?)\b)/gi, '$1 3/4 ')
        .replace(/\r/g, '').replace(/[\t ]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      if (!text) throw new Error('No recipe text was provided.');
      let lines = text.split('\n')
        .flatMap(splitRepeatedTitleLead)
        .flatMap(line => {
          const combinedHeading = line.match(/^\s*(ingredients?|instructions?|directions?|method|steps)\s*[:：-]?\s+(.+)$/i);
          if (!combinedHeading) return [line];
          const tail = combinedHeading[2].trim();
          const tailWords = tail.match(/[A-Za-z][A-Za-z'-]*/g) || [];
          const isInstructionSection = /^(?:instructions?|directions?|method|steps)$/i.test(combinedHeading[1])
            && tailWords.length <= 7 && !/[.!?]$/.test(tail);
          return [combinedHeading[1], isInstructionSection ? `[${tail}]` : tail];
        })
        .flatMap(line => line.split(/\s+(?=(?:(?:(?:prep(?:aration)?|active|cook(?:ing)?)(?:\s*time)?|total\s*time|yield|serves|servings|makes|calories?)\s*[:：-]?\s*\d|cost\s*[:：-]?\s*\$?\d|(?:course|cuisine|keywords?)\s*[:：-]?\s*[A-Za-z]))/i))
        .map(stripEmbeddedClutter)
        .filter(Boolean);
      // OCR frequently puts a noisy rating fragment and title on one line, then
      // starts the description with "This <title>" on the next line. Recover
      // the repeated title across that line break before title scoring.
      for (let index = 1; index < Math.min(lines.length, 14); index++) {
        const currentWords = lines[index].match(/[A-Za-z][A-Za-z'-]*/g) || [];
        if (!/^this\b/i.test(lines[index]) || currentWords.length < 3) continue;
        const previousWords = lines[index - 1].match(/[A-Za-z][A-Za-z'-]*/g) || [];
        const descriptionTitle = currentWords.slice(1);
        let length = Math.min(8, previousWords.length, descriptionTitle.length);
        while (length >= 2) {
          const left = previousWords.slice(-length).map(word => word.toLowerCase());
          const right = descriptionTitle.slice(0, length).map(word => word.toLowerCase());
          if (left.every((word, wordIndex) => word === right[wordIndex])) {
            lines[index - 1] = previousWords.slice(-length).join(' ');
            break;
          }
          length--;
        }
      }
      const nonblank = lines.filter(Boolean);
      const heading = line => line.toLowerCase().replace(/[:：]$/, '').trim();
      const ingredientHeads = new Set(['ingredients', 'ingredient', 'what you need']);
      const instructionHeads = new Set(['instructions', 'directions', 'method', 'steps', 'preparation']);
      const noteHeads = new Set(['notes', 'note', 'tips', 'tip']);
      const equipmentHeads = new Set(['equipment', 'equipment needed', 'tools']);
      const nutritionHeads = new Set(['nutrition', 'nutrition information', 'nutrition info']);
      const clutter = /^(?:save|share|print|rate|reviews?|jump to recipe|advertisement|sponsored|subscribe|sign up|log in|privacy policy|terms of use|select all|deselect all|check all|uncheck all|copy ingredients?|add to (?:shopping )?list|cook mode|keep screen awake|open in app|download app|view comments|how to reset your cortisol belly|eat these foods every day|learn more|see the list)$/i;
      const attribution = /^(?:(?:recipe\s+)?courtesy\s+of\b|(?:photo|photograph|image)\s+(?:by|courtesy|credit)\b|(?:written|posted|updated|published|reviewed)\s+by\b)/i;
      const titleBoundary = nonblank.findIndex((line,index) => {
        const h=heading(line);
        return ingredientHeads.has(h)
          || instructionHeads.has(h)
          || /^(?:cake|filling|topping)\s*:?\s*$/i.test(line)
          || /^[A-Z][A-Z &-]{2,30}:$/.test(line)
          || (index>0 && /^(?:\d+(?:\s+\d+\/\d+|[ ./-]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s+\S+/i.test(line));
      });
      const titlePool = titleBoundary===0 ? [] : titleBoundary>0 ? nonblank.slice(0,titleBoundary) : nonblank.slice(0,12);
      const titleCandidates = titlePool.filter(line =>
        !clutter.test(line)
        && !attribution.test(line)
        && !ingredientHeads.has(heading(line))
        && !instructionHeads.has(heading(line))
        && !/^(?:cake|filling|topping)\s*:?\s*$/i.test(line)
        && !/^(?:active|prep|cook|total)\s*time\b/i.test(line)
        && !/^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(line)
        && !/^(?:preheat|mix|combine|stir|add|place|put|take|bake|cook|heat|whisk|whip|beat|fold|pour|serve|remove|let|chill|refrigerate|freeze|slice|cut|spread|sprinkle|bring|reduce|cover|drain|dust|flip|roll|unroll|unravel|melt|dip)\b/i.test(line)
        && !/[.!?]\s*(?:preheat|mix|stir|add|bake|whip|fold|freeze|slice|cut|melt|dip)\b/i.test(line)
        && !/\b\d+\s*(?:seconds?|minutes?|hours?)\b/i.test(line)
      );
      const titleScore = line => {
        const words=line.match(/[A-Za-z]{2,}/g)||[],letters=(line.match(/[A-Za-z]/g)||[]).length,visible=(line.match(/[A-Za-z0-9]/g)||[]).length;
        if(words.length<2||words.length>10||visible&&letters/visible<.7||/^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(line))return -100;
        return (/\b(?:recipe|cake|pancakes?|rolls?|bread|soup|salad|sauce|cookies?|pie|pies|chicken|beef|pork|pasta|cider)\b/i.test(line)?35:0)+(words.length<=6?8:0)-(/[=}{<>|]/.test(line)?30:0);
      };
      const selectedTitle=titleCandidates.slice(0,24).map((line,index)=>({line,index,score:titleScore(line)+(index===0?40:0)})).sort((a,b)=>b.score-a.score||a.index-b.index)[0];
      const result = { name:selectedTitle?.score>0?selectedTitle.line:'Imported Recipe', category: '', description: '', prepTime: '', cookTime: '', yieldText: '', tags: [], ingredients: [], ingredientGroups: [], instructions: [], notes: '' };
      let section = 'meta'; let currentGroup = { name: 'Main', ingredients: [] };
      const groups = [currentGroup], description = [], notes = [], equipment = [], nutrition = [];
      let keywordContinuation = false;
      const BULLET_MARK = '\uE000';
      const stepAction = '(?:preheat|grease|line|mix|combine|stir|add|make|place|put|take|bake|cook|heat|whisk|whip|beat|fold|pour|serve|remove|return|toss|scoop|scrape|set|divide|top|let|chill|refrigerate|freeze|slice|cut|turn|knead|pat|brush|spread|sprinkle|bring|reduce|cover|drain|dust|flip|roll|unroll|unravel|melt|dip|tap|cool|reform)';
      const numberedAction = new RegExp(`^\\d{1,2}(?:[.),]|\\s+(?=${stepAction}\\b))\\s*`, 'i');
      const isBulletLine = line => new RegExp(`^(?:${BULLET_MARK}|[-•*▪◦]+\\s*)`).test(String(line || '').trim());
      const stripBullet = line => line.trim().replace(BULLET_MARK, '').replace(/^[-•*▪◦]+\s*/, '').replace(numberedAction, '').replace(/\s+\d{1,2}[.)]\s*$/, '').trim();
      const looksIngredient = line => /^(?:\d+(?:\s+\d+\/\d+|[ ./-]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six)\b/i.test(line) || /\b(?:cup|cups|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|grams?|kg|ml|cloves?|cans?|packages?|pinch|dash)\b/i.test(line);
      const actionStart = new RegExp(`^(?:${stepAction}|in\\s+(?:a|an|another|the))\\b`, 'i');
      const looksInstruction = line => /^\d+[.),]\s*/.test(line) || actionStart.test(stripBullet(line));
      const groupHeading = line => {
        const match = line.match(/^(?:for|to make)\s+(.+?)\s*:?$/i);
        if (match) return [match[0], match[1].replace(/^the\s+/i, '').trim()];
        return /^[A-Z][A-Z &-]{2,30}:?$/.test(line) ? [line, line.replace(/:$/, '')] : null;
      };
      const garbageLine = line => {
        const value = String(line || '').trim();
        if (/\b(?:cortisol|resident-owned|nexdoo|prime|sponsored|advertisement|amazon|xfinity)\b/i.test(value)) return true;
        if (/^(?:[)\[(+|¥{}]*\s*)?(?:o-|s|ex:?|ls\]?|j)$/i.test(value) || /\bablt\b.*\d+kcal\b/i.test(value)) return true;
        const letters = (value.match(/[A-Za-z]/g) || []).length;
        const symbols = (value.match(/[={}\\|¥®©]/g) || []).length;
        return symbols >= 2 && letters < 28;
      };
      const metadataMatch = (line, label) => {
        const labelPattern = new RegExp(label, 'i');
        const found = labelPattern.exec(line);
        if (!found || found.index > 8 || /[A-Za-z]{3,}/.test(line.slice(0, found.index))) return null;
        return line.slice(found.index).match(new RegExp(`^${label}\\s*[:：-]?\\s*(.+)$`, 'i'));
      };
      const instructionHeading = (line, nextLine='') => {
        const match = line.match(/^\d{1,2}[.)]\s*(.+)$/);
        const candidate = match?.[1] || stripBullet(line);
        if (!candidate || /[.!?]\s*$/.test(candidate) || isBulletLine(line)) return '';
        const value = candidate.trim().replace(/:\s*$/, '');
        const words = value.match(/[A-Za-z][A-Za-z'-]*/g) || [];
        if (words.length < 1 || words.length > 7) return '';
        if (match) return value;
        const followedByBullet = isBulletLine(nextLine);
        const headingShape = /^(?:slow[- ]?roast|make|cook|prepare|assemble|finish|serve|bake|mix)\b/i.test(value);
        return followedByBullet && headingShape ? value : '';
      };
      let seenTitle = false;
      lines.forEach((line,lineIndex) => {
        if (!line || clutter.test(line) || attribution.test(line) || garbageLine(line) || /^\d+[.)]?$/.test(line)) return;
        if (!seenTitle && line === result.name) { seenTitle = true; return; }
        const embeddedTotal=line.match(/\btotal(?:\s*time)?\s*[:：-]\s*(\d+(?:\s*(?:hours?|hrs?|minutes?|mins?))(?:\s*\d+\s*(?:minutes?|mins?))?)/i);
        const webpageMeta=(line.match(/\b(?:reviews?|ratings?|level|nutrition\s*info|calories?)\b/gi)||[]).length;
        if(embeddedTotal&&webpageMeta){
          notes.push(`Total time: ${embeddedTotal[1].trim()}`);
          return;
        }
        if(webpageMeta&&section==='meta'&&/^(?:\W*\w+\W*){1,8}$/i.test(line))return;
        const h = heading(line);
        if (ingredientHeads.has(h)) { section = 'ingredients'; keywordContinuation = false; return; }
        if (instructionHeads.has(h)) { section = 'instructions'; keywordContinuation = false; return; }
        if (noteHeads.has(h)) { section = 'notes'; keywordContinuation = false; return; }
        if (equipmentHeads.has(h)) { section = 'equipment'; keywordContinuation = false; return; }
        if (nutritionHeads.has(h)) { section = 'nutrition'; keywordContinuation = false; return; }
        let match;
        if (section === 'meta') {
          if ((match = metadataMatch(line, '(?:active|prep(?:aration)?)(?:\\s*time)?'))) { result.prepTime = match[1].trim(); return; }
          if ((match = metadataMatch(line, 'cook(?:ing)?(?:\\s*time)?'))) { result.cookTime = match[1].trim(); return; }
          if ((match = metadataMatch(line, 'total(?:\\s*time)?'))) { notes.push(`Total time: ${match[1].trim()}`); return; }
          if ((match = metadataMatch(line, '(?:yield|serves|servings|makes)'))) { result.yieldText = match[1].trim(); return; }
          if ((match = metadataMatch(line, '(?:category|course)'))) { result.category = match[1].trim(); keywordContinuation = false; return; }
          if ((match = metadataMatch(line, '(?:tags?|keywords?)'))) {
            match[1].split(/[,;]+/).map(x => x.trim()).filter(Boolean).forEach(value => {
              if (!result.tags.some(tag => tag.toLowerCase() === value.toLowerCase())) result.tags.push(value);
            });
            keywordContinuation = true;
            return;
          }
          if ((match = metadataMatch(line, 'cuisine'))) {
            const cuisines = match[1].split(/[,;]+/).map(x => x.trim()).filter(Boolean);
            cuisines.forEach(value => { if (!result.tags.some(tag => tag.toLowerCase() === value.toLowerCase())) result.tags.push(value); });
            notes.push(`Cuisine: ${cuisines.join(', ')}`);
            keywordContinuation = false;
            return;
          }
          if ((match = metadataMatch(line, 'calories?'))) { notes.push(`Calories: ${match[1].trim()}`); keywordContinuation = false; return; }
          if ((match = metadataMatch(line, 'cost'))) { notes.push(`Cost: ${match[1].trim()}`); keywordContinuation = false; return; }
          if (keywordContinuation) {
            const continuation = line.replace(/^(?:[®©]\s*)*(?:Co\s+)?/i, '').trim();
            if (continuation && /[,;]|\b(?:recipes?|pasta|vegan|dairy[- ]free)\b/i.test(continuation)) {
              const parts = continuation.split(/[,;]+/).map(value => value.trim()).filter(Boolean);
              if (/^pasta\s+recipes?\b/i.test(parts[0] || '') && /dairy[- ]free$/i.test(result.tags[result.tags.length - 1] || '')) {
                result.tags[result.tags.length - 1] = `${result.tags[result.tags.length - 1]} ${parts.shift()}`;
              }
              parts.forEach(value => { if (!result.tags.some(tag => tag.toLowerCase() === value.toLowerCase())) result.tags.push(value); });
              return;
            }
            keywordContinuation = false;
          }
        }
        if (section === 'meta') {
          const gh=groupHeading(line),next=lines.slice(lineIndex+1).find(Boolean);
          if(gh&&next&&looksIngredient(next)){section='ingredients';currentGroup={name:gh[1].trim(),ingredients:[]};groups.push(currentGroup);return;}
        }
        if (section === 'ingredients') {
          if (looksInstruction(line)) { section = 'instructions'; result.instructions.push(stripBullet(line)); return; }
          const gh = groupHeading(line);
          if (gh && !looksIngredient(line)) { currentGroup = { name: gh[1].trim(), ingredients: [] }; groups.push(currentGroup); }
          else currentGroup.ingredients.push(stripBullet(line));
        } else if (section === 'instructions') {
          const nextLine = lines.slice(lineIndex + 1).find(Boolean) || '';
          const sectionName = instructionHeading(line, nextLine);
          result.instructions.push(sectionName ? `[${sectionName}]` : `${isBulletLine(line) ? BULLET_MARK : ''}${stripBullet(line)}`);
        }
        else if (section === 'notes') notes.push(line);
        else if (section === 'equipment') equipment.push(stripBullet(line));
        else if (section === 'nutrition') nutrition.push(stripBullet(line));
        else if (looksIngredient(line) && !looksInstruction(line)) { section = 'ingredients'; currentGroup.ingredients.push(stripBullet(line)); }
        else if (looksInstruction(line)) { section = 'instructions'; result.instructions.push(`${isBulletLine(line) ? BULLET_MARK : ''}${stripBullet(line)}`); }
        else description.push(line);
      });
      result.ingredientGroups = groups.filter(group => group.ingredients.length);
      result.ingredients = result.ingredientGroups.flatMap(group => group.ingredients);
      const instructionFragments = result.instructions
        .flatMap(step => {
          const marked = step.startsWith(BULLET_MARK);
          return step.replace(BULLET_MARK, '').split(/\s+(?=\d+[.)]\s+)/).map((fragment, index) => `${marked && index === 0 ? BULLET_MARK : ''}${fragment}`);
        })
        .map(step => `${step.startsWith(BULLET_MARK) ? BULLET_MARK : ''}${stripBullet(step)}`)
        .filter(Boolean)
        .filter(step => (step.match(/[A-Za-z]{2,}/g) || []).length);
      const rawInstructions = [];
      instructionFragments.forEach(step => {
        const embeddedHeading = step.match(/^(cake|filling|topping)\s*:$/i)?.[1]?.toLowerCase();
        if (embeddedHeading) {
          if (embeddedHeading === 'filling' && /^whip$/i.test(rawInstructions[rawInstructions.length - 1] || '')) {
            rawInstructions[rawInstructions.length - 1] += ' filling';
          }
          return;
        }
        if (groups.some(group => group.name && group.name.toLowerCase() === step.replace(/:$/, '').toLowerCase())) return;
        rawInstructions.push(step);
      });
      const mergedInstructions = [];
      rawInstructions.forEach(step => {
        if (/^\[[^\]]+\]$/.test(step)) mergedInstructions.push(step);
        else if (step.startsWith(BULLET_MARK)) mergedInstructions.push(step);
        else if (!mergedInstructions.length || (looksInstruction(step) && !/^\(/.test(step))) mergedInstructions.push(step);
        else mergedInstructions[mergedInstructions.length - 1] += ` ${step}`;
      });
      const structuredInstructions = [];
      mergedInstructions.forEach((step, index) => {
        const marked = step.startsWith(BULLET_MARK);
        const body = step.replace(BULLET_MARK, '').trim();
        if (/^\[[^\]]+\]$/.test(body)) { structuredInstructions.push(body); return; }
        const trailingHeading = body.match(/^(.*?[.!?])\s+((?:Make|Cook|Prepare|Assemble|Finish|Serve|Bake|Mix)\b[^.!?]{0,45})$/i);
        if (trailingHeading) {
          structuredInstructions.push(`${marked ? BULLET_MARK : ''}${trailingHeading[1].trim()}`);
          structuredInstructions.push(`[${trailingHeading[2].trim()}]`);
          return;
        }
        const nextIsBullet = mergedInstructions[index + 1]?.startsWith(BULLET_MARK);
        const words = body.match(/[A-Za-z][A-Za-z'-]*/g) || [];
        const standaloneHeading = !marked && nextIsBullet && words.length <= 7 && /^(?:slow[- ]?roast|make|cook|prepare|assemble|finish|serve|bake|mix)\b/i.test(body) && !/[.!?]$/.test(body);
        structuredInstructions.push(standaloneHeading ? `[${body}]` : step);
      });
      for (let index = 1; index < structuredInstructions.length; index++) {
        if (/^Melt\b/i.test(structuredInstructions[index]) && /\bDip\b/i.test(structuredInstructions[index])) {
          structuredInstructions[index - 1] = structuredInstructions[index - 1].replace(/\s+Dip\b[\s\S]*$/i, '').trim();
        }
      }
      const hasFillingGroup = groups.some(group => /^filling$/i.test(group.name));
      const repairInstruction = step => {
        let repaired = step.replace(/\s+/g, ' ').trim();
        if (hasFillingGroup) repaired = repaired.replace(/\ba layer of\s+on\b/gi, 'a layer of filling on');
        repaired = repaired.replace(/([.!?])\s+your\s+(.+?)\s+into\b/gi, '$1 Dip your $2 into');
        repaired = repaired.replace(/\byour\s+your\b/gi, 'your');
        repaired = repaired.replace(/\bPour\s+the\s+wet(?:\s+ingredients)?\s+into\s+the\s+dry(?:\s+ingredients)?\b/gi, 'Pour the wet ingredients into the dry ingredients');
        // OCR often drops punctuation where a second imperative begins.
        repaired = repaired.replace(/([a-z0-9)])\s+(Preheat|Grease|Line|Mix|Combine|Stir|Add|Place|Put|Take|Bake|Cook|Heat|Whisk|Whip|Beat|Fold|Pour|Serve|Remove|Let|Chill|Refrigerate|Freeze|Slice|Cut|Spread|Sprinkle|Bring|Reduce|Cover|Drain|Dust|Flip|Roll|Unroll|Unravel|Melt|Dip|Tap|Cool)\b/g, (match, before, verb, offset, whole) => {
          const prefix = whole.slice(Math.max(0, offset - 18), offset + 1);
          if (/\b(?:and|or|then)\s*$/i.test(prefix)) return match;
          return `${before}. ${verb}`;
        });
        repaired = repaired.replace(/\)\s+(slowly|gradually)\s+(add|pour|mix|stir|whisk|beat)\b/gi, '). $1 $2');
        repaired = repaired.replace(/\bthen\s*[.]\s*$/i, '.');
        repaired = repaired.replace(/([.!?])\s+\)\s*/g, '$1) ');
        repaired = repaired.replace(/([.!?])\1+/g, '$1');
        repaired = repaired.replace(/^Cover[.]\s+Refrigerate\b/i, 'Cover and refrigerate');
        repaired = repaired.replace(/\s+([,.!?])/g, '$1');
        return repaired;
      };
      const segmentInstruction = step => {
        const preserveBullet = step.startsWith(BULLET_MARK);
        const repairedBase = repairInstruction(step.replace(BULLET_MARK, ''));
        const repaired = preserveBullet ? repairedBase : repairedBase.replace(/\s+and\s+(?=(?:roll\s+back|freeze|chill|refrigerate|dip|tap)\b)/gi, '. ');
        if (/^\[[^\]]+\]$/.test(repaired) || preserveBullet) return [repaired];
        const sentences = repaired.match(/[^.!?]+[.!?]+[)"'’”]*|[^.!?]+$/g) || [repaired];
        const segments = [];
        sentences.forEach(sentence => {
          let value = sentence.trim();
          if (!value) return;
          // Split only high-confidence comma transitions; preserve openers such as “In a bowl, whisk…”.
          const commaParts = actionStart.test(value)
            ? value.split(/,\s+(?=(?:and\s+)?(?:put|take|remove|flip|roll|unroll|unravel|freeze|chill|refrigerate|dip|tap|cool)\b)/i)
            : [value];
          commaParts.forEach(part => {
            let cleaned = part.trim().replace(/^and\s+/i, '');
            cleaned = cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned;
            if (!cleaned) return;
            const previous = segments[segments.length - 1];
            const isCaution = /^(?:do not|don't|be careful|make sure|avoid)\b/i.test(cleaned);
            const isShortSupport = !actionStart.test(cleaned) && (/^\(/.test(cleaned) || (cleaned.match(/[A-Za-z]{2,}/g) || []).length <= 7);
            if (previous && (isCaution || isShortSupport)) segments[segments.length - 1] = `${previous.replace(/[.!?]?$/, '')}. ${cleaned}`;
            else segments.push(cleaned);
          });
        });
        return segments;
      };
      result.instructions = structuredInstructions.flatMap(segmentInstruction).map(step => step.replace(BULLET_MARK, '').trim()).filter(Boolean);
      const halfCupOil = result.ingredients.some(value => /^1\/2\s+cups?\b.*\b(?:olive\s+)?oil\b/i.test(value));
      result.instructions = result.instructions.map(step => {
        let repaired = step;
        if (halfCupOil && /\b(?:olive\s+)?oil\b/i.test(repaired)) repaired = repaired.replace(/\babout\s+2\s+cups?\b/i, 'about 1/2 cup');
        repaired = repaired.replace(/\b(Add the soft butter,\s*)2\s+tsp\s+salt\b/i, (match, prefix) => `${prefix}1/2 tsp salt`);
        return repaired;
      });
      result.description = description.join(' ').replace(/\bflavorpacked\b/gi, 'flavor-packed').replace(/\btomatobasil\b/gi, 'tomato-basil').trim();
      if (equipment.length) notes.push(`Equipment:\n${equipment.map(value => `- ${value}`).join('\n')}`);
      if (nutrition.length) notes.push(`Nutrition:\n${nutrition.join('\n')}`);
      result.notes = notes.join('\n').trim();
      return result;
    }
  }

  globalThis.KitchenCompanionEngine = KitchenCompanionEngine;
})();
