import TestWFRP from "./test-wfrp4e.js"

export default class PrayerTest extends TestWFRP {

  constructor(data, actor) {
    super(data, actor)
    if (!data)
      return
    this.preData.skillSelected = data.skillSelected;
    this.computeTargetNumber();
    this.preData.skillSelected = data.skillSelected instanceof Item ? data.skillSelected.name : data.skillSelected;

  }

  computeTargetNumber() {
    try {
      // Determine final target if a characteristic was selected
      if (this.preData.skillSelected.char)
        this.result.target = this.actor.characteristics[this.preData.skillSelected.key].value

      else if (this.preData.skillSelected.name == this.item.skillToUse.name)
        this.result.target = this.item.skillToUse.total.value

      else if (typeof this.preData.skillSelected == "string") {
        let skill = this.actor.getItemTypes("skill").find(s => s.name == this.preData.skillSelected)
        if (skill)
          this.result.target = skill.total.value
      }
      else
        this.result.target = this.item.skillToUse.total.value

    }
    catch {
      this.result.target = this.item.skillToUse.total.value
    }

    super.computeTargetNumber();
  }

  runPreEffects() {
    super.runPreEffects();
    this.actor.runEffects("preRollPrayerTest", { test: this, cardOptions: this.context.cardOptions })
  }

  runPostEffects() {
    super.runPostEffects();
    this.actor.runEffects("preRollPrayerTest", { test: this, cardOptions: this.context.cardOptions }, {item : this.item})
    Hooks.call("wfrp4e:rollPrayerTest", this, this.context.cardOptions)
  }

  async computeResult() {
    await super.computeResult();
    let SL = this.result.SL;
    let currentSin = this.actor.status.sin.value
    this.result.overcast = duplicate(this.item.overcast)

    // Test itself failed
    if (this.result.outcome == "failure") {
      this.result.description = game.i18n.localize("ROLL.PrayRefused")

      // Wrath of the gads activates if ones digit is equal or less than current sin
      let unitResult = Number(this.result.roll.toString().split('').pop())
      if (unitResult == 0)
        unitResult = 10;
      if (this.result.roll % 11 == 0 || unitResult <= currentSin) {
        if (this.result.roll % 11 == 0)
          this.result.color_red = true;

        this.result.wrath = game.i18n.localize("ROLL.Wrath")
        this.result.wrathModifier = Number(currentSin) * 10;
      }
    }
    // Test succeeded
    else {
      this.result.description = game.i18n.localize("ROLL.PrayGranted")

      // Wrath of the gads activates if ones digit is equal or less than current sin      
      let unitResult = Number(this.result.roll.toString().split('').pop())
      if (unitResult == 0)
        unitResult = 10;
      if (unitResult <= currentSin) {
        this.result.wrath = game.i18n.localize("ROLL.Wrath")
        this.result.wrathModifier = Number(currentSin) * 10;
      }
    }

    this.result.overcasts = Math.max(0, Math.floor(SL / 2)); // For allocatable buttons
    this.result.overcast.total = this.result.overcasts
    this.result.overcast.available = this.result.overcast.total;

    await this._calculateDamage()
  }


  async _calculateDamage() {
    this.result.additionalDamage = this.preData.additionalDamage || 0
    // Calculate damage if prayer specifies
    try {
      if (this.item.DamageString && this.result.outcome == "success")
        this.result.damage = Number(this.item.Damage)
      if (this.item.damage.addSL)
        this.result.damage = Number(this.result.SL) + (this.result.damage || 0)

      if (this.item.damage.dice && !this.result.additionalDamage) {
        let roll = await new Roll(this.item.damage.dice).roll()
        this.result.diceDamage = { value: roll.total, formula: roll.formula };
        this.preData.diceDamage = this.result.diceDamage
        this.result.additionalDamage += roll.total;
        this.preData.additionalDamage = this.result.additionalDamage;
      }
    }
    catch (error) {
      ui.notifications.error(game.i18n.localize("ErrorDamageCalc") + ": " + error)
    } // If something went wrong calculating damage, do nothing and still render the card
  }

  postTest() {
    if (this.result.wrath) {
      let sin = this.actor.status.sin.value - 1
      if (sin < 0) sin = 0
      this.actor.update({ "system.status.sin.value": sin });
      ui.notifications.notify(game.i18n.localize("SinReduced"));
    }
  }

  
  // @@@@@@@ Overcast functions placed in root class because it is used by both spells and prayers @@@@@@@
  async _overcast(choice) {
    if (this.result.overcast.usage[choice].AoE)
    {
      return ui.notifications.error(game.i18n.localize("ERROR.PrayerAoEOvercast"))
    }
    return super._overcast(choice)
  }

  get prayer() {
    return this.item
  }

  get characteristicKey() {
    if (this.preData.skillSelected.char)
      return this.preData.skillSelected.key

    else {
      let skill = this.actor.getItemTypes("skill").find(s => s.name == this.preData.skillSelected)
      if (skill)
        return skill.characteristic.key
    }
  }
}