import React from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useProfileQuery} from 'state/queries/profile'
import {useSession} from 'state/session'
import {useWizardState} from '#/screens/StarterPack/Wizard/State'
import {atoms as a} from '#/alf'
import * as TextField from '#/components/forms/TextField'
import {StarterPackIcon} from '#/components/icons/StarterPackIcon'
import {Text} from '#/components/Typography'

export function StepDetails() {
  const {_} = useLingui()
  const [state, dispatch] = useWizardState()

  const {currentAccount} = useSession()
  const {data: currentProfile} = useProfileQuery({
    did: currentAccount?.did,
    staleTime: 300,
  })

  return (
    <View style={[a.px_xl, a.gap_xl, a.mt_4xl]}>
      <View style={[{height: 65}]}>
        <StarterPackIcon />
      </View>
      <View style={[a.gap_md, a.align_center, a.px_md, a.mb_md]}>
        <Text style={[a.font_bold, a.text_3xl]}>
          <Trans>Invites, but personal</Trans>
        </Text>
        <Text style={[a.text_center, a.text_md, a.px_md]}>
          <Trans>
            Create a starter pack to invite new users to Bluesky and give them
            your favorite feeds and follows.
          </Trans>
        </Text>
      </View>
      <View>
        <TextField.LabelText>{_(msg`Name`)}</TextField.LabelText>
        <TextField.Input
          label={_(
            msg`${
              currentProfile?.displayName || currentProfile?.handle
            }'s starter pack`,
          )}
          value={state.name}
          onChangeText={text => dispatch({type: 'SetName', name: text})}
        />
      </View>
      <View>
        <TextField.LabelText>{_(msg`Description`)}</TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            label={_(
              msg`Write a short description of your starter pack. What can new users expect?`,
            )}
            value={state.description}
            onChangeText={text =>
              dispatch({type: 'SetDescription', description: text})
            }
            multiline
            style={{minHeight: 150}}
          />
        </TextField.Root>
      </View>
    </View>
  )
}