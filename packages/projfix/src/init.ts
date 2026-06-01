import { createInterface } from 'readline'
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DS_OPTIONS = ['chakra-v3', 'chakra-v2', 'mui', 'antd', 'mantine', 'generic']
const ICON_OPTIONS = ['lucide', 'heroicons', 'fa', 'mdi', 'generic']
const DIR_OPTIONS = ['rtl', 'ltr', 'both']
const CAL_OPTIONS = ['jalali', 'hijri', 'gregorian']

function validate(value: string, options: string[], fallback: string): string {
  return options.includes(value) ? value : fallback
}

export async function runInit(targetDir: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = (question: string, defaultVal: string): Promise<string> =>
    new Promise(resolve =>
      rl.question(`  ${question} [${defaultVal}]: `, answer => {
        resolve(answer.trim() || defaultVal)
      })
    )

  const configPath = resolve(targetDir, '.projfix.json')

  if (existsSync(configPath)) {
    const overwrite = await ask('.projfix.json already exists. Overwrite? (y/N)', 'N')
    if (overwrite.toLowerCase() !== 'y') {
      rl.close()
      console.log('  Cancelled.')
      return
    }
  }

  console.log('\n🛠  projfix init\n')

  const directionRaw = await ask('Direction (rtl/ltr/both)', 'rtl')
  const direction = validate(directionRaw, DIR_OPTIONS, 'rtl')

  const defaultLocale = direction === 'ltr' ? 'en-US' : 'fa-IR'
  const locale = await ask('Locale', defaultLocale)

  const defaultCal = direction === 'ltr' ? 'gregorian' : 'jalali'
  const calendarRaw = await ask('Calendar (jalali/hijri/gregorian)', defaultCal)
  const calendar = validate(calendarRaw, CAL_OPTIONS, defaultCal)

  const dsRaw = await ask(`Design system (${DS_OPTIONS.join('/')})`, 'generic')
  const ds = validate(dsRaw, DS_OPTIONS, 'generic')

  const iconRaw = await ask(`Icon library (${ICON_OPTIONS.join('/')})`, 'lucide')
  const icon_lib = validate(iconRaw, ICON_OPTIONS, 'lucide')

  rl.close()

  const config = {
    direction,
    locale,
    calendar,
    ds,
    icon_lib,
    ignore: ['node_modules', 'dist', '.next', 'build', 'coverage'],
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  console.log(`\n✅  Created ${configPath}\n`)
  console.log(JSON.stringify(config, null, 2))
  console.log()
}
